const http = require('http');
const Koa = require('koa');
const koaBody = require('koa-body');
const koaStatic = require('koa-static');
const Router = require('koa-router');
const cors = require('koa2-cors');
const WS = require('ws');
const path = require('path');
const Storage = require('./Storage')



const app = new Koa();
const router = new Router();

//to parse bordy
app.use(koaBody({
    json: true, text: true, urlencoded: true, multipart: true,
  }));

//for CORS
app.use(
 cors({
      origin: '*',
      credentials: true,
      'Access-Control-Allow-Origin': true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    })
  );

//Routers
  app.use(router.routes()).use(router.allowedMethods());

//Files Directory organisation
  const filesDir = path.join(__dirname, '/public');
  app.use(koaStatic(filesDir));

// Starting Server
const port = process.env.PORT || 7070;
const server = http.createServer(app.callback());
const wsServer = new WS.Server({ server });

// DATABASE
const dB = [
    {id: '123', message: 'Просто текст', date: Date.now() - 500000000, geo: '', type: 'text'},
    {id: '124', message: 'Feci quod potui faciant meliora potentes', date: Date.now() - 450000000, geo: '', type: 'text'},
    {id: '125', message: 'Т', date: Date.now() - 400000000, geo: '', type: 'text'},
    {id: '126', message: 'Homo sum, humani nihil a me alienum puto.', date: Date.now() - 400000000, geo: '', type: 'text'},
    {id: '127', message: 'Тест - текст с координатами', date: Date.now() - 350000000, geo: '68.692493, 37.607834', type: 'text'},
    {id: '29a86030-d83c-11eb-9a19-87bef25338c3', message: 'Ссылки 1 http://scientificrussia.ru 2 https://yandex.ru 3 https://google.com 4 http://vk.com', date: Date.now() - 300000000, geo: '', type: 'text'},
    {id: 'd4bb4b20-da82-11eb-9154-2d8ca54d4d13', message: 'astronaut.jpg', date: Date.now() - 250000000, geo: '', type: 'image'},
    {id: '128', message: 'production.mp4', date: Date.now() - 200000000, type: 'video'},
    {id: '129', message: 'Space_Air Force.mp3', date: Date.now() - 150000000, geo: '55.692493, 37.607834', type: 'audio'},
    {id: '130', message: 'astrology.pdf', date: Date.now() - 100000000, geo: '', type: 'file'},
    {id: '131', message: 'Сообщение в избранном', date: Date.now(), geo: '', type: 'text'},
];
const category = {
links: [
    { name: 'http://scientificrussia.ru', messageId: '29a86030-d83c-11eb-9a19-87bef25338c3' },
    { name: 'https://yandex.ru', messageId: '29a86030-d83c-11eb-9a19-87bef25338c3' },
    { name: 'https://google.com', messageId: '29a86030-d83c-11eb-9a19-87bef25338c3' },
    { name: 'http://vk.com', messageId: '29a86030-d83c-11eb-9a19-87bef25338c3' },
    ],
image: [
        { name: 'astronaut.jpg', messageId: 'd4bb4b20-da82-11eb-9154-2d8ca54d4d13' },
    ],
video: [
        { name: 'production.mp4', messageId: '128' },
    ],
audio: [
        { name: 'Space_Air Force.mp3', messageId: '129' },
      ],
file: [
        { name: 'astrology.pdf', messageId: '130' },
      ],
};
const  favourites = new Set(['127', '29a86030-d83c-11eb-9a19-87bef25338c3', '125', '131']);


const clients = [];
wsServer.on('connection', (ws) => {
    clients.push(ws);
    const storage = new Storage(dB,category,favourites,filesDir,ws,clients);
    storage.init();

router.post('/upload', async (ctx) => {
    storage.loadFile(ctx.request.files.file, ctx.request.body.geo).then((result) => {
        storage.wsAllSend({...result, event: 'file' });
    });
    ctx.response.status = 204;
    });

ws.on('close', () => {
    const wsIndex = clients.indexOf(ws);
    if(wsIndex !== -1){
        clients.splice(wsIndex,1);
    }
  });
});

server.listen(port, () => console.log('Server started'));
