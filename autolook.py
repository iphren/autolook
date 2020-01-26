import socket, os, json
from dotenv import load_dotenv

def path(filename):
  if not os.path.isabs(filename):
    return os.path.join(os.getcwd(),filename)
  return filename

def send(subject,content=str(),attachs=list()):
  load_dotenv()
  address = ('localhost',int(os.getenv('NOTE_PORT')))
  data = {'subject': subject, 'content': content}
  data['attachs'] = [path(f) for f in attachs]
  data = json.dumps(data)
  with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    try:
      s.connect(address)
    except:
      print(f'connection error: {address}')
      return False
    try:
      s.sendall(bytearray(data,'utf-8'))
      return True
    except:
      print('sending error: failed')
      return False
