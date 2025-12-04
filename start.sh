#!/bin/bash
cd backend
exec gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:$PORT app:app
