const uuid = require('uuid');
const path = require('path');
const fs = require('fs');
const { constants } = require('buffer');

module.exports = class Storage{
    constructor(dBase,categorydBase,filesDir,favouritesdBase,ws,clients){
        this.ws = ws;
        this.clients = clients;
        this.dBase = dBase;
        this.category = categorydBase;
        this.filesDir = filesDir;
        this.favourites = favouritesdBase;
        this.types = ['image','video','audio'];
    }

    init(){
        //при условии открытого веб сокета
        this.ws.on('message', (msg) => {
         const data = JSON.parse(msg);

         //запрос данных из базы данных
         if(data.event === 'load'){
             this.eventLoad(data.msg);
         }

         //запрос данных из категории
         if(data.event === 'storage'){
            this.eventStorage(data.msg);
        }

         //запрос сообщений из базы данных
         if(data.event === 'select'){
            this.eventSelect(data.msg);
        }

        //новое сообщение
          if(data.event === 'message'){
            this.eventMessage(data.msg);
        }

        //удалить сообщение
           if(data.event === 'delete'){
            this.eventDelete(data.msg);
        }
        
        //добавить в избранное
        if(data.event === 'favourite'){
            this.eventFavourite(data.msg);
        }

       //удалить из избранного
        if(data.event === 'favouriteRemove'){
            this.eventFavouriteRemove(data.msg);
        }

      //запрос на все избранные сообщения
        if(data.event === 'favouritesLoad'){
            this.eventFavouritesRemove(data.msg);
        }
    
      //закрепить сообщение
        if(data.event === 'pin'){
            this.evenPin(data.msg);
        }

     //открепить сообщение
        if(data.event === 'unpin'){
            this.evenUnpin(data.msg);
        }
     });
    }

 // Запрос на данные из БД
 eventLoad(position){
     //Простая загрузка
     const startPosition = position || this.dBase.length;
     const itemCounter = startPosition > 10 ? 10 : startPosition;
     const returndBase = [];
     for (let i = 1; i <= itemCounter; i += 1) {
       returndBase.push(this.dBase[startPosition - i]);
     }
 
    const pinnedMessage = this.dBase.find((message) => message.pinned);
    const data = {
        event: 'database',
        dBase: returndBase,
        favourites: [...this.favourites],
        pinnedMessage,
        side: this.createSideObject(),
        position: startPosition - 10,
      };
      this.wsSend(data);
    }

  // Запрос на данные из категории
  eventStorage(category) {
        this.wsSend({ event: 'storage', category, data: this.category[category] });
      }

  // Запрос на выдачу сообщения из БД
  eventSelect(select) {
    const message = this.dBase.find((item) => item.id === select);
    this.wsSend({ event: 'select', message });
  }

  // Новое сообщение
  eventMessage(message){
    const{text,geo} = message;
    const data = {
      id: uuid.v1(),
      message: text,
      date: Date.now(),
      type: 'text',
      geo,
    };
    this.dataBase.push(data);
    this.recordToLinks(text, data.id);
    this.wsAllSend({ ...data, event: 'text', side: this.createSideObject() });
  }

  
  // Удаление сообщения
  eventDelete(id){
    const unlinkFiles = new Set;
    [...this.allowedTypes, 'links', 'file'].forEach((type) => {
      const filesInCategory = this.category[type].filter((item) => item.messageId === id).map((item) => item.name);
      filesInCategory.forEach((fileName) =>unlinkFiles.add(fileName));
      this.category[type] = this.category[type].filter((item) => item.messageId !==id);
      });
      unlinkFiles.forEach((fileName) => {
        fs.unlink(path.join(this.filesDir, fileName), () => {});
      });

      this.favourites.delete(id);

      const messageIndex = this.dBase.findIndex((item) => item.id === id);
      this.dBase.splice(messageIndex, 1);
      this.wsAllSend({ id, event: 'delete', side: this.createSideObject() })
  }

  // Добавление в избранное
  eventFavourite(id) {
      this.favourites.add(id);
      this.wsAllSend({ id, event: 'favourite', side: this.createSideObject() });
  }

  // Удаление из избранного 
  eventFavouriteRemove(id) {
    this.favourites.delete(id);
    this.wsAllSend({ id, event: 'favouriteRemove', side: this.createSideObject() });
  }

// Выборка всех избранных сообщений
eventFavouritesLoad(){
  const filterMessages = this.dBase.filter((message) => this.favourites.has(message.id));
  //Для простой загрузки
  const startPosition = filterMessages.length;
  const itemCounter = startPosition > 10 ? 10 : startPosition;
  const returndBase = [];
  for (let i = 1; i <= itemCounter; i += 1) {
    returndBase.push(filterMessages[startPosition - i]);
  }

  const pinnedMessage = this.dBase.find((message) => message.pinned);

  const data = {
    event: 'favouritesLoad',
    dBase: returndBase,
    favourites: [...this.favourites],
    pinnedMessage,
    side: this.createSideObject(),
    position: startPosition - 10,
  };
  this.wsSend(data);
}

  // Закрепление сообщения
  eventPin(id) {
    const isPinned =this.dBase.find((message) => message.pinned);
    if(!isPinned){
      const pinnedMessage = this.dBase.find((message) => message.id === id);
      pinnedMessage.pinned = true;
      this.wsAllSend ({pinnedMessage,event:'pin'});
    }
  delete isPinned.pinned;
  }

  //Открепление сообщения
  eventUnpin(id){
    delete this.dBase.find((message) => message.id === id).pinned;
    this.wsAllSend({id,event:'unpin'});
  }

  // Отправка ответа сервера
  wsSend(responseData) {
    const errCallback = (err) => {
      if (err) {
        throw new Error(err);
      }
    };
    this.ws.send(JSON.stringify(responseData,errCallback));
  }

  // Рассылка ответов всем клиента сервера (для поддержки синхронизации)
  wsAllSend(responseData) {
    for(const client of this.clients) {
      const errCallback = (err) => {
        if (err) {
          throw new Error(err);
        }
      };
      client.send(JSON.stringify(responseData,errCallback));
    }
  }

  //Созданиние обьекта side с информацией по категориям хранилища;
  createSideObject(){
    const sideL = {};
    sideL.favourites = this.favourites.size;
    for (const category in this.category){
      sideL[category] = this.category[category].length;
    }
    return sideL;
   }

  
  // Получение и обработка файлов 
  loadFile(file, geo) {
    return new Promise((resolve, reject) => {
    const { fileName, fileType } = this.fileToFile(file);
    const oldPath = file.path;
    const newPath = path.join(this.filesDir, fileName);

    const callback = (error) => reject(error);

    const readStream = fs.createReadStream(oldPath);
    const writeStream = fs.createWriteStream(newPath);

    readStream.on('error', callback);
    writeStream.on('error', callback);

    readStream.on('close', () => {
      fs.unlink(oldPath, callback);

      const data = {
        id: uuid.v1(),
        message: fileName,
        date: Date.now(),
        type: fileType,
        geo,
      };
      this.dBase.push(data);

      this.category[fileType].push({ name: fileName, messageId: data.id });

      resolve({ ...data, side: this.createSideObject() });
    });

    readStream.pipe(writeStream);
  });
}

// Распределение в базу файлов
fileToFile(file) {
  // Определяем тип файла
  let fileType = file.type.split('/')[0];
  fileType = this.allowedTypes.includes(fileType) ? fileType : 'file';

   // Если файл - Blob из MediaRecorder
   if (file.name === 'blob') {
    file.name = `recorder.${file.type.split('/')[1]}`;
  }
  let fileName = file.name;
  let index = 1;
  while (this.category[fileType].findIndex((item) => item.name === fileName) > -1) {
    const fileExtension = file.name.split('.').pop();
    const filePrefName = file.name.split(fileExtension)[0].slice(0, -1);
    fileName = `${filePrefName}_${index}.${fileExtension}`;
    index += 1;
  }
  return { fileName, fileType };
 }
  //Запись в базу ссылок
  recordToLinks(text,messageId) {
    const links = text.match(/(http:\/\/|https:\/\/){1}(www)?([\da-z.-]+)\.([a-z.]{2,6})([/\w.-?%#&-]*)*\/?/gi);
    if (links){
      this.category.links.push(...links.map((item) => ({name: item, messageId })));
  }
 }
};
