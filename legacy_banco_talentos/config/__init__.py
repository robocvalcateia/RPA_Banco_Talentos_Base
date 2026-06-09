"""Mdulo de configurao"""
from .mongodb import get_mongodb
from .gemini import get_gemini
from .microsoft_graph import get_microsoft_graph
from .ultramsg import get_ultramsg

__all__ = [
    'get_mongodb',
    'get_gemini',
    'get_microsoft_graph',
    'get_ultramsg'
]
