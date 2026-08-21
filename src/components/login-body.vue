<script setup>
import { reactive, watch, getCurrentInstance } from "vue";
import utils from "../common/utils";
import { useRouter } from "vue-router";
import { STORAGE, RESPONSE } from "../common/enum";
import common from "../common/common";
import Storage from "../common/storage";
import { User } from "../services/index";
import im from "../common/im";
import ModalServerSetting from "../components/modal-server-setting.vue";

const props = defineProps(["isLogin", "isAdd", "isShow"]);

let juggle = im.getCurrent();
let context = getCurrentInstance();

const router = useRouter();

let defalutBtnLabel = 'Kod Gönder';

let state = reactive({
  isQRLogin: !utils.isMobile(),
  isLoadingQR: false,
  isShowRefreshQrcode: false,
  qrcode: {
    img: '',
    uid: ''
  },
  user: {
    phone: '',
    code: ''
  },
  btnLabel: defalutBtnLabel,
  errorMsg: {
    phone: '',
    code: ''
  }
});

function onVerifySuccess(result){
  let { data } = result;
  let { user_id, authorization, nickname, avatar, im_token } = data;

  if(!avatar){
    avatar = common.getTextAvatar(nickname);
  }

  if(!im_token){
    return state.errorMsg.code = 'Giriş başarısız: IM Token bulunamadı.'
  }

  let user = {
    id: user_id,
    token: im_token,
    authorization: authorization,
    name: nickname,
    portrait: avatar,
    isUsed: true
  };

  Storage.set(STORAGE.USER_TOKEN, user);

  let accounts = Storage.get(STORAGE.USERS);

  if(utils.isEmpty(accounts)){
    accounts = [user]
  }

  if(!props.isLogin){
    let index = utils.find(accounts, (account) => {
      return utils.isEqual(account.id, user.id);
    });

    if(utils.isEqual(index, -1)){
      accounts.push(user);
    }
  }

  Storage.set(STORAGE.USERS, accounts);

  if(props.isLogin){
    router.replace({ name: 'ConversationList' });
  }else{
    location.reload();
  }
}

function onLogin() {
  let { user } = state;
  let { phone, code } = user;

  if (utils.isEmpty(phone)) {
    return state.errorMsg.phone = 'Telefon numarası boş bırakılamaz.';
  }

  if(!utils.isPhoneNumber(phone)) {
    return state.errorMsg.phone = 'Telefon numarası geçersiz.';
  }

  if (utils.isEmpty(code)) {
    return state.errorMsg.code = 'Doğrulama kodu boş bırakılamaz.';
  }

  User.verifyCode({ phone, code }).then((result) => {
    let errorCode = result.code;

    if(!utils.isEqual(errorCode, RESPONSE.SUCCESS)){
      return context.proxy.$toast({
        text: `Giriş başarısız. Hata kodu: ${errorCode}`,
        icon: 'error'
      });
    }

    onVerifySuccess(result);
  });
}

let isSending = false;

function onSend(){
  let { user } = state;
  let { phone } = user;

  if (utils.isEmpty(phone)) {
    return state.errorMsg.phone = 'Telefon numarası boş bırakılamaz.';
  }

  if (!utils.isPhoneNumber(phone)) {
    return state.errorMsg.phone = 'Telefon numarası geçersiz.';
  }

  if(isSending){
    isSending = true;
    return;
  }

  User.sendCode({ phone }).then((result) => {
    let errorCode = result.code;

    if(!utils.isEqual(errorCode, RESPONSE.SUCCESS)){
      return context.proxy.$toast({
        text: `Doğrulama kodu gönderilemedi. Hata kodu: ${errorCode}`,
        icon: 'error'
      });
    }

    let seconds = 59;

    utils.extend(state, { btnLabel: seconds });

    let inteval = setInterval(() => {
      seconds -= 1;

      if(utils.isEqual(seconds, 1)){
        utils.extend(state, {
          btnLabel: defalutBtnLabel,
          isSending: false
        });

        return clearInterval(inteval);
      }

      utils.extend(state, { btnLabel: seconds });
    }, 500);
  });
}

function onInput() {
  utils.extend(state.errorMsg, {
    phone: '',
    code: ''
  });
}

function setQrLogin(isQR){
  state.isQRLogin = isQR;
}

function getLoginQR(){
  state.isLoadingQR = true;

  User.getQRCode().then((result) => {
    state.isLoadingQR = false;

    let { code, data } = result;

    if(!utils.isEqual(code, RESPONSE.SUCCESS)){
      return;
    }

    let { qr_code: img, id } = data;

    utils.extend(state, {
      qrcode: {
        img,
        uid: id
      },
      isShowRefreshQrcode: false
    });

    if(state.isQRLogin){
      startPolling()
    }
  });
}

let user = Storage.get(STORAGE.USER_TOKEN);

if(!utils.isMobile() && !user.id){
  getLoginQR();
}

let pollingTimer = 0;

function startPolling(){
  let {
    qrcode: { uid }
  } = state;

  if(!uid){
    return;
  }

  User.startPolling({ id: uid }).then((result) => {
    let { code, data } = result;

    if(utils.isEqual(code, RESPONSE.LOGIN_QR_WATTING)){
      pollingTimer = setTimeout(() => {
        startPolling();
      }, 2 * 1000);
    }

    if(utils.isEqual(code, RESPONSE.LOGIN_QR_EXPIRE)){
      state.isShowRefreshQrcode = true;
    }

    if(utils.isEqual(code, RESPONSE.SUCCESS)){
      onVerifySuccess(result);
    }
  });
}

function stopPolling(){
  clearTimeout(pollingTimer);
}

function onShowServerSetting(isShow){
  state.isShowServerSetting = isShow;
}

watch(() => state.isQRLogin, (isQR) => {
  if(isQR){
    startPolling();
  }else{
    stopPolling();
  }
});

watch(() => props.isShow, () => {
  if(props.isShow){
    getLoginQR();
  }else{
    stopPolling();
  }
});
</script>

<template>
  <div
    class="tyn-root jg-login-container"
    :class="{
      'tyn-desktop-root': juggle.isDesktop(),
      'tyn-web-root': !juggle.isDesktop()
    }"
  >

    <div
      class="jg-server-settings wr wr-security-sum"
      @click="onShowServerSetting(true)"
      v-if="props.isLogin">
    </div>

    <div class="jg-nlogin-main" v-if="state.isQRLogin">

      <div
        class="jg-nlogin-qrbox"
        :style="{
          'background-image':
            'url(data:image/png;base64,' + state.qrcode.img + ')'
        }"
      >

        <div class="jg-nlogin-icon"></div>

        <div
          class="jg-nlogin-loading-box"
          v-if="state.isShowRefreshQrcode"
        >

          <div
            class="jg-nlogin-loading"
            v-if="state.isLoadingQR">
          </div>

          <div class="jg-nlogin-refresh" v-else>
            <button
              class="btn btn-sm btn-success"
              @click="getLoginQR()"
            >
              QR Kodu Yenile
            </button>
          </div>

        </div>
      </div>

      <div class="jg-nlogin-intro-box">

        <h2 class="jg-nlogin-intro-title">
          QR Kod ile JuggleChat'e Giriş Yap
        </h2>

        <ul class="jg-nlogin-intros">

          <li class="jg-nlogin-intro wr wr-1">
            Telefonunuzdan JuggleChat'i açın
          </li>

          <li class="jg-nlogin-intro wr wr-2">
            Ana Sayfa → QR Kod bölümüne gidin
          </li>

          <li class="jg-nlogin-intro wr wr-3">
            Girişi onaylamak için telefonunuzla bu QR kodu tarayın
          </li>

        </ul>

        <div
          class="jg-nlogin-button"
          @click="setQrLogin(false)"
        >
          TELEFON NUMARASIYLA GİRİŞ YAP
        </div>

      </div>
    </div>

    <div class="jg-nlogin-main" v-else>

      <div class="jg-nlogin-normalbox">
        <div class="jg-nlogin-nlicon"></div>

        <h2 class="jg-nlogin-nltitle">
          JuggleChat
        </h2>

        <span class="fs10">
          v1.7.24
        </span>
      </div>

      <div class="jg-nlogin-intro-box jg-nlogin-btnbox">

        <div class="form-group">

          <div class="form-control-wrap">
            <input
              type="text"
              class="form-control"
              v-model="state.user.phone"
              placeholder="Telefon numaranızı girin"
              @input="onInput()"
              @keydown.enter="onLogin()"
            >
          </div>

          <label class="form-label" for="email-address">
            <span class="small ms-2 text-danger">
              {{ state.errorMsg.phone }}
            </span>
          </label>

        </div>

        <div class="form-group">

          <div class="form-control-wrap jg-login-sms form-control">

            <input
              type="text"
              v-model="state.user.code"
              placeholder="Doğrulama kodu: 000000"
              @input="onInput()"
              @keydown.enter="onLogin()"
            >

            <div
              class="jg-login-sendcode"
              @click="onSend"
            >
              {{ state.btnLabel }}
            </div>

          </div>

          <label class="form-label">
            <span class="small ms-2 text-danger">
              {{ state.errorMsg.code }}
            </span>
          </label>

        </div>

        <div class="form-group">
          <div class="form-control-wrap">

            <a
              class="btn btn-primary w-100"
              @click="onLogin()"
            >
              Giriş Yap
            </a>

          </div>
        </div>

        <div
          class="jg-nlogin-button jg-nlogin-num-btn"
          @click="setQrLogin(true)"
        >
          QR KOD İLE GİRİŞ YAP
        </div>

      </div>
    </div>

  </div>

  <ModalServerSetting
    :is-show="state.isShowServerSetting"
    @oncancel="onShowServerSetting(false)"
  >
  </ModalServerSetting>

</template>
