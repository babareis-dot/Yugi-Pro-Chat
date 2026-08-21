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

let defalutBtnLabel = "Kod Gönder";

let state = reactive({
  isQRLogin: false,
  isLoadingQR: false,
  isShowRefreshQrcode: false,
  isShowServerSetting: false,

  qrcode: {
    img: "",
    uid: ""
  },

  user: {
    email: "",
    code: ""
  },

  btnLabel: defalutBtnLabel,

  errorMsg: {
    email: "",
    code: ""
  }
});


function showToast(text, icon = "error") {
  try {
    if (
      context &&
      context.proxy &&
      context.proxy.$toast
    ) {
      context.proxy.$toast({
        text,
        icon
      });
    }
  } catch (error) {
    console.error(error);
  }
}


function showLoginError(message) {
  state.errorMsg.code = message;
  showToast(message, "error");
}


function onVerifySuccess(result) {

  if (!result) {
    showLoginError(
      "Sunucudan giriş cevabı alınamadı."
    );
    return;
  }

  if (!result.data) {
    console.error(
      "Giriş cevabı:",
      result
    );

    showLoginError(
      "Sunucudan gelen giriş cevabı eksik."
    );
    return;
  }

  let data = result.data;

  let user_id = data.user_id;
  let authorization = data.authorization;
  let nickname = data.nickname;
  let avatar = data.avatar;
  let im_token = data.im_token;

  if (!user_id) {
    console.error(
      "Kullanıcı ID bulunamadı:",
      result
    );

    showLoginError(
      "Giriş başarısız: Kullanıcı bilgisi alınamadı."
    );
    return;
  }

  if (!authorization) {
    console.error(
      "Authorization bulunamadı:",
      result
    );

    showLoginError(
      "Giriş başarısız: Oturum anahtarı alınamadı."
    );
    return;
  }

  if (!im_token) {
    console.error(
      "IM Token bulunamadı:",
      result
    );

    showLoginError(
      "Giriş başarısız: IM Token alınamadı."
    );
    return;
  }

  nickname =
    nickname ||
    state.user.email.split("@")[0] ||
    "Kullanıcı";

  if (!avatar) {
    avatar = common.getTextAvatar(
      nickname
    );
  }

  let user = {
    id: user_id,
    token: im_token,
    authorization: authorization,
    name: nickname,
    portrait: avatar,
    email: state.user.email,
    isUsed: true
  };

  Storage.set(
    STORAGE.USER_TOKEN,
    user
  );

  let accounts =
    Storage.get(STORAGE.USERS);

  if (
    utils.isEmpty(accounts) ||
    !Array.isArray(accounts)
  ) {
    accounts = [];
  }

  let index = utils.find(
    accounts,
    (account) => {
      return utils.isEqual(
        account.id,
        user.id
      );
    }
  );

  if (
    utils.isEqual(index, -1)
  ) {
    accounts.push(user);
  } else {
    accounts[index] = user;
  }

  Storage.set(
    STORAGE.USERS,
    accounts
  );

  state.errorMsg.code = "";

  showToast(
    "Giriş başarılı.",
    "success"
  );

  if (props.isLogin) {

    router
      .replace({
        name: "ConversationList"
      })
      .catch((error) => {

        console.error(
          "Sayfa yönlendirme hatası:",
          error
        );

        location.reload();

      });

  } else {

    location.reload();

  }
}


function onLogin() {

  state.errorMsg.email = "";
  state.errorMsg.code = "";

  let email =
    String(
      state.user.email || ""
    ).trim();

  let code =
    String(
      state.user.code || ""
    ).trim();

  if (utils.isEmpty(email)) {
    state.errorMsg.email =
      "E-posta adresi boş bırakılamaz.";
    return;
  }

  if (!utils.isEmail(email)) {
    state.errorMsg.email =
      "Geçerli bir e-posta adresi girin.";
    return;
  }

  if (utils.isEmpty(code)) {
    state.errorMsg.code =
      "Doğrulama kodu boş bırakılamaz.";
    return;
  }

  state.user.email = email;
  state.user.code = code;

  User
    .verifyCode({
      email,
      code
    })
    .then((result) => {

      console.log(
        "E-posta giriş cevabı:",
        result
      );

      if (!result) {
        showLoginError(
          "Sunucudan cevap alınamadı."
        );
        return;
      }

      let errorCode =
        result.code;

      /*
        Bazı sunucularda başarı kodu
        sayı 0, bazılarında "0"
        şeklinde gelebilir.
      */
      let isSuccess =
        utils.isEqual(
          errorCode,
          RESPONSE.SUCCESS
        ) ||
        String(errorCode) ===
          String(RESPONSE.SUCCESS);

      if (!isSuccess) {

        let message =
          result.msg ||
          result.message ||
          `Hata kodu: ${errorCode}`;

        showLoginError(
          `Giriş başarısız: ${message}`
        );

        return;
      }

      onVerifySuccess(result);

    })
    .catch((error) => {

      console.error(
        "E-posta giriş hatası:",
        error
      );

      let message =
        error &&
        error.message
          ? error.message
          : "Bilinmeyen bağlantı hatası";

      showLoginError(
        `Giriş isteği başarısız: ${message}`
      );

    });
}


let isSending = false;


function onSend() {

  state.errorMsg.email = "";
  state.errorMsg.code = "";

  let email =
    String(
      state.user.email || ""
    ).trim();

  if (utils.isEmpty(email)) {
    state.errorMsg.email =
      "E-posta adresi boş bırakılamaz.";
    return;
  }

  if (!utils.isEmail(email)) {
    state.errorMsg.email =
      "Geçerli bir e-posta adresi girin.";
    return;
  }

  if (isSending) {
    return;
  }

  state.user.email = email;

  isSending = true;

  state.btnLabel =
    "Gönderiliyor...";

  User
    .sendCode({
      email
    })
    .then((result) => {

      console.log(
        "Kod gönderme cevabı:",
        result
      );

      if (!result) {

        isSending = false;
        state.btnLabel =
          defalutBtnLabel;

        showLoginError(
          "Kod gönderme sunucusundan cevap alınamadı."
        );

        return;
      }

      let errorCode =
        result.code;

      let isSuccess =
        utils.isEqual(
          errorCode,
          RESPONSE.SUCCESS
        ) ||
        String(errorCode) ===
          String(RESPONSE.SUCCESS);

      if (!isSuccess) {

        isSending = false;

        state.btnLabel =
          defalutBtnLabel;

        let message =
          result.msg ||
          result.message ||
          `Hata kodu: ${errorCode}`;

        showLoginError(
          `Doğrulama kodu gönderilemedi: ${message}`
        );

        return;
      }

      showToast(
        "Doğrulama kodu e-posta adresinize gönderildi.",
        "success"
      );

      let seconds = 59;

      state.btnLabel =
        `${seconds} sn`;

      let interval =
        setInterval(() => {

          seconds -= 1;

          if (seconds <= 0) {

            clearInterval(
              interval
            );

            state.btnLabel =
              defalutBtnLabel;

            isSending = false;

            return;
          }

          state.btnLabel =
            `${seconds} sn`;

        }, 1000);

    })
    .catch((error) => {

      console.error(
        "Kod gönderme hatası:",
        error
      );

      isSending = false;

      state.btnLabel =
        defalutBtnLabel;

      let message =
        error &&
        error.message
          ? error.message
          : "Bağlantı hatası";

      showLoginError(
        `Doğrulama kodu gönderilemedi: ${message}`
      );

    });

}


function onInput() {

  utils.extend(
    state.errorMsg,
    {
      email: "",
      code: ""
    }
  );

}


function setQrLogin(isQR) {

  state.isQRLogin = isQR;

}


function getLoginQR() {

  state.isLoadingQR = true;

  User
    .getQRCode()
    .then((result) => {

      state.isLoadingQR =
        false;

      if (!result) {
        return;
      }

      let code =
        result.code;

      let data =
        result.data;

      let isSuccess =
        utils.isEqual(
          code,
          RESPONSE.SUCCESS
        ) ||
        String(code) ===
          String(RESPONSE.SUCCESS);

      if (!isSuccess) {
        return;
      }

      if (!data) {
        return;
      }

      let img =
        data.qr_code;

      let id =
        data.id;

      utils.extend(
        state,
        {
          qrcode: {
            img,
            uid: id
          },

          isShowRefreshQrcode:
            false
        }
      );

      if (
        state.isQRLogin
      ) {
        startPolling();
      }

    })
    .catch((error) => {

      state.isLoadingQR =
        false;

      console.error(
        "QR kod hatası:",
        error
      );

    });

}


let pollingTimer = 0;


function startPolling() {

  let uid =
    state.qrcode.uid;

  if (!uid) {
    return;
  }

  User
    .startPolling({
      id: uid
    })
    .then((result) => {

      if (!result) {
        return;
      }

      let code =
        result.code;

      if (
        utils.isEqual(
          code,
          RESPONSE.LOGIN_QR_WATTING
        )
      ) {

        pollingTimer =
          setTimeout(() => {
            startPolling();
          }, 2000);

      }

      if (
        utils.isEqual(
          code,
          RESPONSE.LOGIN_QR_EXPIRE
        )
      ) {

        state.isShowRefreshQrcode =
          true;

      }

      let isSuccess =
        utils.isEqual(
          code,
          RESPONSE.SUCCESS
        ) ||
        String(code) ===
          String(RESPONSE.SUCCESS);

      if (isSuccess) {
        onVerifySuccess(
          result
        );
      }

    })
    .catch((error) => {

      console.error(
        "QR giriş kontrol hatası:",
        error
      );

    });

}


function stopPolling() {

  clearTimeout(
    pollingTimer
  );

}


function onShowServerSetting(
  isShow
) {

  state.isShowServerSetting =
    isShow;

}


watch(
  () => state.isQRLogin,
  (isQR) => {

    if (isQR) {

      if (
        !state.qrcode.uid
      ) {
        getLoginQR();
      } else {
        startPolling();
      }

    } else {

      stopPolling();

    }

  }
);


watch(
  () => props.isShow,
  () => {

    if (
      props.isShow &&
      state.isQRLogin
    ) {

      getLoginQR();

    } else {

      stopPolling();

    }

  }
);

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
      v-if="props.isLogin"
    >
    </div>


    <!-- QR KOD İLE GİRİŞ -->

    <div
      class="jg-nlogin-main"
      v-if="state.isQRLogin"
    >

      <div
        class="jg-nlogin-qrbox"
        :style="{
          'background-image':
          'url(data:image/png;base64,' +
          state.qrcode.img +
          ')'
        }"
      >

        <div
          class="jg-nlogin-icon"
        >
        </div>

        <div
          class="jg-nlogin-loading-box"
          v-if="state.isShowRefreshQrcode"
        >

          <div
            class="jg-nlogin-loading"
            v-if="state.isLoadingQR"
          >
          </div>

          <div
            class="jg-nlogin-refresh"
            v-else
          >

            <button
              class="btn btn-sm btn-success"
              @click="getLoginQR()"
            >
              QR Kodu Yenile
            </button>

          </div>

        </div>

      </div>


      <div
        class="jg-nlogin-intro-box"
      >

        <h2
          class="jg-nlogin-intro-title"
        >
          QR Kod ile JuggleChat'e Giriş Yap
        </h2>

        <ul
          class="jg-nlogin-intros"
        >

          <li
            class="jg-nlogin-intro wr wr-1"
          >
            Telefonunuzdan JuggleChat'i açın
          </li>

          <li
            class="jg-nlogin-intro wr wr-2"
          >
            Ana Sayfa → QR Kod bölümüne gidin
          </li>

          <li
            class="jg-nlogin-intro wr wr-3"
          >
            Girişi onaylamak için QR kodu tarayın
          </li>

        </ul>

        <div
          class="jg-nlogin-button"
          @click="setQrLogin(false)"
        >
          E-POSTA İLE GİRİŞ YAP
        </div>

      </div>

    </div>


    <!-- E-POSTA İLE GİRİŞ -->

    <div
      class="jg-nlogin-main"
      v-else
    >

      <div
        class="jg-nlogin-normalbox"
      >

        <div
          class="jg-nlogin-nlicon"
        >
        </div>

        <h2
          class="jg-nlogin-nltitle"
        >
          JuggleChat
        </h2>

        <span
          class="fs10"
        >
          v1.7.24
        </span>

      </div>


      <div
        class="jg-nlogin-intro-box jg-nlogin-btnbox"
      >

        <!-- E-POSTA -->

        <div
          class="form-group"
        >

          <div
            class="form-control-wrap"
          >

            <input
              type="email"
              class="form-control"
              v-model="state.user.email"
              placeholder="E-posta adresinizi girin"
              autocomplete="email"
              @input="onInput()"
              @keydown.enter="onLogin()"
            >

          </div>

          <label
            class="form-label"
          >

            <span
              class="small ms-2 text-danger"
            >
              {{ state.errorMsg.email }}
            </span>

          </label>

        </div>


        <!-- DOĞRULAMA KODU -->

        <div
          class="form-group"
        >

          <div
            class="form-control-wrap jg-login-sms form-control"
          >

            <input
              type="text"
              inputmode="numeric"
              v-model="state.user.code"
              placeholder="E-postanıza gelen doğrulama kodunu girin"
              autocomplete="one-time-code"
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

          <label
            class="form-label"
          >

            <span
              class="small ms-2 text-danger"
            >
              {{ state.errorMsg.code }}
            </span>

          </label>

        </div>


        <!-- GİRİŞ -->

        <div
          class="form-group"
        >

          <div
            class="form-control-wrap"
          >

            <a
              class="btn btn-primary w-100"
              @click="onLogin()"
            >
              Giriş Yap
            </a>

          </div>

        </div>


        <!-- QR -->

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
