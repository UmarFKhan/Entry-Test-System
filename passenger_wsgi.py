import os
import sys

# Ensure repo directory is in Python path for cPanel Phusion Passenger
sys.path.insert(0, os.path.dirname(__file__))

from app import app

# Expose 'application' for Passenger WSGI standard, as well as 'app'
application = app
