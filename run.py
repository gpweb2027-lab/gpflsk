from app import create_app
from app.extensions import socketio


app = create_app()

#82.67.172.104
if __name__ == "__main__":

    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=True,
        use_reloader=False,
        allow_unsafe_werkzeug=True
    )