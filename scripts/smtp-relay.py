#!/usr/bin/env python3
"""
SMTP Relay for SendFlow — runs on the VPS and receives email over HTTP
from Vercel serverless functions, then forwards via SMTP to mail.baahe.org.
"""
import sys
import json
import base64
from http.server import HTTPServer, BaseHTTPRequestHandler
from smtplib import SMTP
from email.message import EmailMessage
from email.utils import make_msgid
import argparse

SMTP_HOST = 'mail.baahe.org'
SMTP_PORT = 465
SMTP_USER = 'sendflow@baahe.org'
SMTP_PASS = 'Baahe@308'
SMTP_FROM = 'sendflow@baahe.org'
SMTP_FROM_NAME = 'SendFlow'

def relay_email(to: str, subject: str, html: str = None, text: str = None) -> dict:
    msg = EmailMessage()
    msg['From'] = f'"{SMTP_FROM_NAME}" <{SMTP_FROM}>'
    msg['To'] = to
    msg['Subject'] = subject
    msg['Message-ID'] = make_msgid(domain='baahe.org')

    if html:
        msg.add_alternative(html, subtype='html')
    if text:
        msg.add_alternative(text, subtype='plain')

    try:
        with SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.ehlo()
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/send':
            self.send_error(404)
            return

        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
        except Exception:
            self.send_error(400)
            return

        to = body.get('to')
        subject = body.get('subject', '')
        html = body.get('html')
        text = body.get('text')

        if not to:
            self.send_error(400)
            return

        result = relay_email(to, subject, html, text)

        self.send_response(200 if result['ok'] else 502)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())

    def log_message(self, format, *args):
        print(f'[smtp-relay] {args[0]}', flush=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8025)
    args = parser.parse_args()

    server = HTTPServer(('0.0.0.0', args.port), Handler)
    print(f'Starting SMTP relay on http://0.0.0.0:{args.port}/send', flush=True)
    sys.stdout.flush()
    server.serve_forever()

if __name__ == '__main__':
    main()