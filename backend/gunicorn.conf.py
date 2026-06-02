# gunicorn.conf.py — production WSGI server config (E5)
# Run: gunicorn -c gunicorn.conf.py app:app

import multiprocessing

# --- Worker settings ---
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "gevent"
worker_connections = 1000   # max concurrent connections per gevent worker
threads = 1
timeout = 120                                    # long enough for NLP inference
graceful_timeout = 30

# --- Binding ---
bind = "0.0.0.0:5000"

# --- Logging ---
accesslog = "-"        # stdout
errorlog  = "-"        # stderr
loglevel  = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s %(D)sµs'

# --- Process naming ---
proc_name = "rcciit-chatbot"
