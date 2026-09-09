// Local-only browser fixture. Never mounted by the production server.
const express=require('express'),fs=require('node:fs'),path=require('node:path');
const app=express(),root=path.resolve(__dirname,'../site');
app.use('/vendor/three',express.static(path.resolve(__dirname,'../node_modules/three')));
app.get('/',(_req,res)=>res.type('html').send(fs.readFileSync(path.join(root,'index.html'),'utf8').replace('</body>','<script src="/__qa.js"></script></body>')));
app.get('/__qa.js',(_req,res)=>res.sendFile(path.join(__dirname,'tactical-qa-browser.js')));
app.use(express.static(root));
app.listen(3003,'127.0.0.1',()=>console.log('Local tactical QA: http://127.0.0.1:3003'));
