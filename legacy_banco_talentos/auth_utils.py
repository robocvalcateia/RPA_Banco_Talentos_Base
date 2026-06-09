"""
Utilitários de autenticação com JWT
Copie este arquivo para a raiz do seu projeto Python
"""

import jwt
import os
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET", "sua_chave_secreta_aqui_2026")
ALGORITHM = "HS256"

def generate_token(email: str, expires_in: int = 24) -> str:
    """
    Gera um JWT token
    
    Args:
        email: E-mail do usuário
        expires_in: Horas até expiração (padrão: 24h)
    
    Returns:
        Token JWT
    """
    payload = {
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=expires_in),
        "iat": datetime.utcnow()
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token

def verify_token(token: str) -> dict:
    """
    Verifica e decodifica um JWT token
    
    Args:
        token: Token JWT
    
    Returns:
        Payload do token se válido, None se inválido
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        print("Token expirado")
        return None
    except jwt.InvalidTokenError:
        print("Token inválido")
        return None

def token_required(f):
    """
    Decorator para proteger endpoints com JWT
    
    Uso:
    @app.route('/api/candidatos')
    @token_required
    def get_candidatos():
        # request.user contém o payload do token
        print(request.user['email'])
        ...
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Verificar se token está no header Authorization
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            try:
                # Esperado: "Bearer token_aqui"
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({
                    "success": False,
                    "error": "Formato de token inválido. Use: Authorization: Bearer <token>"
                }), 401
        
        if not token:
            return jsonify({
                "success": False,
                "error": "Token não fornecido. Use header: Authorization: Bearer <token>"
            }), 401
        
        # Verificar token
        payload = verify_token(token)
        if not payload:
            return jsonify({
                "success": False,
                "error": "Token inválido ou expirado"
            }), 401
        
        # Adicionar payload do token ao request
        request.user = payload
        return f(*args, **kwargs)
    
    return decorated