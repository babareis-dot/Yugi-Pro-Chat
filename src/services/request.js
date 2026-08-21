import utils from '../common/utils';
import { STORAGE, RESPONSE, EVENT_NAME } from '../common/enum';
import Storage from '../common/storage';
import EventSent from '../common/eventsent';
import emitter from "../common/emmit";
import { CONFIG } from '../config';

function request(url, options = {}){
  let user = Storage.get(STORAGE.USER_TOKEN) || {};
  let { authorization } = user;

  let headers = {
    'Content-Type': 'application/json',
    AppKey: CONFIG.appkey
  };

  if(authorization){
    headers['Authorization'] = authorization;
  }

  let _headers = options.headers || {};
  options.headers = utils.extend(_headers, headers);

  return fetch(url, options).then(async (res) => {

    if(utils.isEqual(res.status, RESPONSE.UNATHORIZED)){
      emitter.$emit(EVENT_NAME.UN_UNATHORIZED);
    }

    const rawText = await res.text();

    console.log('API URL:', url);
    console.log('HTTP Status:', res.status);
    console.log('Sunucu cevabı:', rawText);

    if(!rawText){
      return {
        code: res.status,
        message: 'Sunucudan boş cevap geldi.',
        http_status: res.status
      };
    }

    try {

      return JSON.parse(rawText);

    } catch(error) {

      console.error('JSON olmayan sunucu cevabı:', rawText);

      return {
        code: res.status,
        message: rawText,
        http_status: res.status,
        raw: rawText
      };

    }

  }).catch((error) => {

    console.error('API bağlantı hatası:', error);

    return {
      code: -1,
      message: error?.message || 'Sunucuya bağlanılamadı.',
      http_status: 0
    };

  });
}

function requestStream(url, options){
  let user = Storage.get(STORAGE.USER_TOKEN) || {};

  let headers = {
    'Authorization': user.authorization || '',
    'X-Platform': 'web',
  };

  utils.extend(options, { headers });

  return new EventSent(url, options);
}

export {
  request,
  requestStream
}
