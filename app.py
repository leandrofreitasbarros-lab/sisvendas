from flask import Flask, request, jsonify, send_from_directory
from database import Database
from flask_cors import CORS
import os

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)
db = Database()

# Rota para servir o frontend
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

# ... (mantenha todas as outras rotas existentes)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
