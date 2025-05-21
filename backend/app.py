from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, disconnect
from flask_cors import CORS
import json
import os
import traceback
from threading import Thread
from crewai import Agent, Task, Crew, Process
from crewai import LLM
import logging
import time

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}) 
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading', ping_timeout=30, ping_interval=15)

# Track active connections for debugging
active_connections = {}

class CrewAIHandler:
    def __init__(self):
        try:
            self.llm = LLM(
                model="azure/gpt-4o-mini",
                temperature=0.7
            )
            logger.info("LLM initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize LLM: {str(e)}")
            self.llm = None
        
    def process_streaming(self, user_input, title_context="", abstract_context="", conversation_history=None, sid=None):
        """Process a user message using CrewAI"""
        
        # Format conversation history for better context
        formatted_history = self._format_conversation_history(conversation_history)
        
        # Run in a separate thread to not block the main thread
        def run_process():
            try:
                # Check if LLM is available
                if not self.llm:
                    raise ValueError("LLM is not initialized properly")
                
                # Let client know we started processing
                socketio.emit('message', {'token': 'Starting to process your request...'}, room=sid)
                
                # Set up observer for streaming
                class StreamingObserver:
                    def on_new_token(self, token, **kwargs):
                        try:
                            socketio.emit('message', {'token': token}, room=sid)
                        except Exception as e:
                            logger.error(f"Error sending token to client {sid}: {str(e)}")
                
                # Set up agent for conversation
                agent = Agent(
                    role="Conversation Guide",
                    goal="Engage users in friendly conversation about business ideas",
                    backstory="You help develop startup ideas with natural, concise responses.",
                    verbose=True,
                    llm=self.llm,
                    output_observer=StreamingObserver()
                )
                
                # Create task
                task = Task(
                    description=f"""
                    The user has sent: "{user_input}"
                    
                    Title Context: {title_context}
                    Abstract Context: {abstract_context}
                    
                    Previous conversation:
                    {formatted_history}
                    
                    Respond in a friendly, conversational manner that:
                    1. Acknowledges their input naturally
                    2. References the current title/topic if relevant
                    3. Provides helpful insight or asks a follow-up question
                    
                    Your response should be conversational, warm, and avoid generic chatbot phrases like "How can I assist you".
                    """,
                    agent=agent,
                    expected_output="A natural, conversational response"
                )
                
                # Create and run crew
                crew = Crew(
                    agents=[agent],
                    tasks=[task],
                    process=Process.sequential,
                    verbose=True
                )
                
                # Run the crew with timeout handling
                result = crew.kickoff()
                
                # Signal completion
                socketio.emit('message', {'done': True}, room=sid)
                
            except Exception as e:
                logger.error(f"Error in CrewAI process: {str(e)}")
                logger.error(traceback.format_exc())
                socketio.emit('message', {'error': f"Processing error: {str(e)}"}, room=sid)
                socketio.emit('message', {'done': True}, room=sid)
        
        # Start process in background thread
        thread = Thread(target=run_process)
        thread.daemon = True
        thread.start()
        
    def _format_conversation_history(self, conversation_history):
        """Format the conversation history for inclusion in the prompt."""
        if not conversation_history:
            return "No previous conversation."
            
        formatted_history = ""
        for msg in conversation_history:
            role = msg.get('role', 'unknown')
            content = msg.get('content', '')
            formatted_history += f"{role.capitalize()}: {content}\n\n"
            
        return formatted_history

# Initialize our handler
crew_handler = CrewAIHandler()

@app.route('/api/health', methods=['GET'])
def health_check():
    """Simple health check endpoint."""
    return jsonify({"status": "healthy", "active_connections": len(active_connections)})

@app.route('/api/chat', methods=['POST'])
def chat():
    """Regular HTTP endpoint for non-streaming responses."""
    try:
        data = request.json
        return jsonify({"message": "Please use WebSocket endpoint for streaming responses"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@socketio.on('connect')
def handle_connect():
    """Handle client connection."""
    sid = request.sid
    active_connections[sid] = {
        'connected_at': time.time(),
        'ip': request.remote_addr
    }
    logger.info(f'Client connected: {sid}')
    # Send immediate feedback that connection was successful
    emit('message', {'token': 'Connected to server successfully. Ready for messages!'})
    emit('message', {'done': True})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    sid = request.sid
    if sid in active_connections:
        del active_connections[sid]
    logger.info(f'Client disconnected: {sid}')

@socketio.on('ping')
def handle_ping():
    """Handle ping from client to keep connection alive."""
    emit('pong')

@socketio.on('message')
def handle_message(data):
    """Handle incoming WebSocket messages."""
    sid = request.sid
    try:
        # Log that we received a message (without details for privacy)
        logger.info(f"Received message from client {sid}")
        
        # Parse the message data
        message_data = json.loads(data) if isinstance(data, str) else data
        
        # Process with CrewAI
        crew_handler.process_streaming(
            message_data.get("user_input", ""),
            message_data.get("title_context", ""),
            message_data.get("abstract_context", ""),
            message_data.get("conversation_history", []),
            sid
        )
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON received from client {sid}")
        emit('message', {'error': 'Invalid message format. Expected JSON.'})
        emit('message', {'done': True})
    except Exception as e:
        logger.error(f"Error handling WebSocket message from {sid}: {str(e)}")
        logger.error(traceback.format_exc())
        emit('message', {'error': f"Server error: {str(e)}"})
        emit('message', {'done': True})

if __name__ == "__main__":
    # Run the Flask application with SocketIO
    logger.info("Starting Flask application with SocketIO on port 8000...")
    
    # Add a health check on startup
    try:
        # Try to initialize any critical resources here to catch errors early
        logger.info("Checking if LLM is initialized...")
        if crew_handler.llm is None:
            logger.warning("LLM initialization may have failed. Check previous logs.")
    except Exception as e:
        logger.error(f"Error during startup checks: {str(e)}")
    
    socketio.run(app, host="0.0.0.0", port=8000, debug=True)