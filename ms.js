require('dotenv').config();
const fs = require('fs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const uuidv4 = require('uuid/v4');
const net = require('net');
const http = require('https');
const querystring = require('querystring');
const path = require('path');

var expiry = Date.now();
var token = {};

function auth() {
  var cert = fs.readFileSync('cert.pem');
  cert = cert.slice(cert.indexOf('\n'),cert.indexOf('-----END CERTIFICATE-----'));
  cert = Buffer.from(cert.toString().replace(/\n/g,''),'base64');
  const hash = crypto.createHash('sha1').update(cert);
  cert = hash.digest().toString('base64');
  
  const jwtid = uuidv4();
  const payload = {
    'aud': `https:\/\/login.microsoftonline.com/${process.env.TENANT}/oauth2/token`,
    'exp': Math.floor(Date.now()/1000) + 60,
    'iss': process.env.APP_ID,
    'jti': jwtid,
    'nbf': Math.floor(Date.now()/1000),
    'sub': process.env.APP_ID
  };
  const key = fs.readFileSync('key.pem');
  const jwtoken = jwt.sign(payload, key, {
    algorithm: 'RS256',
    noTimestamp: true,
    header: {'x5t':cert}
  });
  
  const data = querystring.stringify({
    'client_id': process.env.APP_ID,
    'scope': process.env.APP_SCOPES,
    'client_assertion_type': process.env.client_assertion_type,
    'client_assertion': jwtoken,
    'grant_type': process.env.grant_type
  });
  
  const options = {
    hostname: 'login.microsoftonline.com',
    port: 443,
    path: `/${process.env.TENANT}/oauth2/v2.0/token`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  return new Promise ((resolve, reject) => {
    let req = http.request(options);
    
    req.once('response', (res) => {
      res.setEncoding('utf8');
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.once("end", () => {
        try {
          const token = JSON.parse(body);
          resolve(token);
        } catch (e) {
          console.error(`auth parse error: ${e.message}`);
          reject(e);
        };
      });
    });
    
    req.on('error', (e) => {
      console.error(`auth connection error: ${e.message}`);
      reject(e);
    });
    
    req.write(data);
    req.end();
  });   
};

async function send(mail) {
  if (Date.now() > expiry) {
    token = await auth();
    expiry = Date.now() + 800 * token.expires_in;
    console.log('new token requested');
  };
  let attachs = [];
  for (let i in mail.attachs) {
    try {
      let af = fs.readFileSync(mail.attachs[i]);
      let attach = {"@odata.type": "#Microsoft.OutlookServices.FileAttachment"};
      attach.Name = path.basename(mail.attachs[i]);
      attach.ContentBytes = af.toString('base64');
      attachs.push(attach);
    } catch (e) {
      console.error(`attachment error: ${e.message}`);
      return;
    };
  };
  const data = JSON.stringify({
    "Message": {
      "Subject": mail.subject,
      "Body": {
        "ContentType": "HTML",
        "Content": mail.content
      },
      "BccRecipients": [
        {
          "EmailAddress": {
            "Address": process.env.EMAIL
          }
        }
      ],
      "Attachments": attachs
    },
    "SaveToSentItems": "false"
  });
  const options = {
    hostname: 'graph.microsoft.com',
    port: 443,
    path: `/v1.0/${process.env.TENANT}/users/${process.env.USER_ID}/sendMail`,
    method: 'POST',
    headers: {
      'Content-Type': "application/json",
      'Authorization': `${token.token_type} ${token.access_token}`,
      'Content-Length': Buffer.byteLength(data)
    }
  };
  let req = http.request(options);
  req.once('response', (res) => {
    res.setEncoding('utf8');
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      console.log(body);
      if (!!body) {
        console.log(new Date);
      };
    });
  });
  req.on('error', (e) => {
    console.error(`server connection error: ${e.message}`);
  });
  req.write(data);
  req.end();
};

exports.send = send;
