<script setup>
import Emoji from "../../components/emoji.vue";
import ModalTransfer from "../../components/modal-transfer.vue";
import ModalImgSender from "../../components/modal-img-sender.vue";
import ModalMergeMsgs from "../../components/modal-merge-msgs.vue";
import Mention from "../../components/mention.vue";
import Transfer from "../../components/transfer-panel.vue";
import Reply from "../../components/reply.vue";
import ConversationAsider from "./conversation-aside.vue";

import {
  reactive,
  shallowRef,
  watch,
  nextTick,
  getCurrentInstance
} from "vue";

import { preview } from "vue3-image-preview";
import im from "../../common/im";

import Text from "../../components/message-text.vue";
import StreamText from "../../components/message-stream-text.vue";
import File from "../../components/message-file.vue";
import ImageMessage from "../../components/message-image.vue";
import Video from "../../components/message-video.vue";
import Merge from "../../components/message-merge.vue";
import Known from "../../components/message-unknown.vue";
import Timeline from "../../components/message-timeline.vue";
import Without from "../../components/message-without.vue";
import RecallMessage from "../../components/message-recall.vue";
import GroupNtfMessage from "../../components/message-group-notify.vue";
import FriendNtfMessage from "../../components/message-friend-notify.vue";
import Call1v1FinishedMessage from "../../components/message-1v1-finished.vue";
import ContactCard from "../../components/message-contact-card.vue";

import utils from "../../common/utils";
import conversationTools from "./conversation";
import messageUtils from "../../components/message-utils";
import Storage from "../../common/storage";

import {
  TRANSFER_TYPE,
  MSG_NAME,
  EVENT_NAME,
  MESSAGE_OP_TYPE,
  STORAGE,
  RESPONSE
} from "../../common/enum";

import common from "../../common/common";
import emitter from "../../common/emmit";
import { Group, AI } from "../../services/index";

const props = defineProps(["conversation"]);

const emit = defineEmits([
  "ondraft",
  "onclearmsg",
  "onquitgroup",
  "ontop",
  "ondisturb",
  "onback"
]);

let TimelineMessage = shallowRef(Timeline);
let WithoutMessage = shallowRef(Without);

let juggle = im.getCurrent();

let {
  MessageType,
  Event,
  ConversationType,
  MentionType,
  SentState,
  MediaType
} = juggle;

let context = getCurrentInstance();

let state = reactive({
  isShowAside: false,
  isShowEmoji: false,
  isShowTransfer: false,
  isShowTransferMember: false,
  isShowGroupMute: false,

  transferType: TRANSFER_TYPE.NONE,

  currentConversation: props.conversation,

  messages: [],

  isFinished: false,

  content: props.conversation.draft || "",

  modifyMessage: {},

  isShowMention: false,

  isShowMobileBack: true,

  isShowReply: false,

  isAsking: false,

  currentReplyMessage: {},

  members: [],

  msgOpType: MESSAGE_OP_TYPE.TRANSLATE,

  mentionMembers: [],

  selectMentionIndex: 0,

  mentions: [],

  transferMsgs: [],

  currentMergeMessage: {},

  imgSender: {},

  group: {},

  pinnedMessage: {},

  memberSearch: ""
});


/* =========================
   GERÇEK ZAMANLI MESAJLAR
========================= */

juggle.once(Event.MESSAGE_RECEIVED, (message) => {
  if (conversationTools.isSameConversation(message, state)) {
    let index = utils.find(state.messages, (msg) => {
      return utils.isEqual(msg.messageId, message.messageId);
    });

    message.streamMsg = {
      isEnd: false,
      streams: []
    };

    if (index == -1) {
      state.messages.unshift(message);
    } else {
      state.messages.splice(index, 1, message);
    }

    scrollBottom();

    conversationTools.readMessage([message]);

    conversationTools.clearUnreadCount(message);

    let isText = utils.isEqual(
      message.name,
      MessageType.TEXT
    );

    if (isText && !message.isSender) {
      conversationTools.translate(
        state,
        [message]
      );
    }
  }
});


juggle.once(
  Event.STREAM_APPENDED,
  ({ message }) => {

    if (
      conversationTools.isSameConversation(
        message,
        state
      )
    ) {

      let msg =
        findMsgById(message) || {};

      if (utils.isEmpty(msg)) {
        return;
      }

      let {
        streams
      } = message;

      utils.extend(
        msg.streamMsg,
        {
          isEnd: false,
          streams
        }
      );
    }
  }
);


juggle.once(
  Event.STREAM_COMPLETED,
  ({ message }) => {

    if (
      conversationTools.isSameConversation(
        message,
        state
      )
    ) {

      let msg =
        findMsgById(message) || {};

      if (utils.isEmpty(msg)) {
        return;
      }

      utils.extend(
        msg.streamMsg,
        {
          isEnd: true,
          streams: []
        }
      );
    }
  }
);


function findMsgById(msg) {

  let {
    messageId
  } = msg;

  let index = utils.find(
    state.messages,
    (_msg) => {
      return utils.isEqual(
        _msg.messageId,
        messageId
      );
    }
  );

  return state.messages[index];
}


juggle.once(
  Event.MESSAGE_UPDATED,
  (notify) => {

    if (
      conversationTools.isSameConversation(
        notify,
        state
      )
    ) {

      let index = utils.find(
        state.messages,
        (msg) => {
          return utils.isEqual(
            msg.messageId,
            notify.messageId
          );
        }
      );

      if (index > -1) {

        utils.extend(
          state.messages[index],
          {
            isUpdated: true,
            content: notify.content
          }
        );

      }
    }
  }
);


juggle.once(
  Event.MESSAGE_REACTION_CHANGED,
  (notify) => {

    if (
      conversationTools.isSameConversation(
        notify,
        state
      )
    ) {

      let index = utils.find(
        state.messages,
        (msg) => {
          return utils.isEqual(
            msg.messageId,
            notify.messageId
          );
        }
      );

      if (index < 0) {
        return;
      }

      let message =
        state.messages[index];

      let list =
        notify.reactions;

      message.reactions =
        message.reactions || {};

      utils.forEach(
        list,
        (item) => {

          let {
            isRemove,
            key,
            value
          } = item;

          let _list =
            message.reactions[key] || [];

          if (isRemove) {

            let _index =
              utils.find(
                _list,
                (_item) => {
                  return (
                    _item.key ==
                    key
                  );
                }
              );

            if (_index > -1) {
              _list.splice(
                _index,
                1
              );
            }

          } else {

            _list.push({
              key,
              value
            });

          }

          if (
            utils.isEqual(
              _list.length,
              0
            )
          ) {

            delete message.reactions[key];

          } else {

            message.reactions[key] =
              _list;

          }
        }
      );
    }
  }
);


juggle.once(
  Event.MESSAGE_REMOVED,
  (notify) => {

    if (
      conversationTools.isSameConversation(
        notify,
        state
      )
    ) {

      let {
        messages
      } = notify;

      utils.forEach(
        messages,
        (item) => {

          let index =
            utils.find(
              state.messages,
              (msg) => {
                return utils.isEqual(
                  msg.messageId,
                  item.messageId
                );
              }
            );

          if (index > -1) {
            state.messages.splice(
              index,
              1
            );
          }
        }
      );
    }
  }
);


juggle.once(
  Event.MESSAGE_RECALLED,
  (notify) => {

    if (
      conversationTools.isSameConversation(
        notify,
        state
      )
    ) {

      let index =
        utils.find(
          state.messages,
          (msg) => {
            return utils.isEqual(
              msg.messageId,
              notify.content.messageId
            );
          }
        );

      if (index > -1) {

        state.messages.splice(
          index,
          1,
          {
            ...notify,
            name:
              MessageType.RECALL_INFO
          }
        );

      }
    }
  }
);


juggle.once(
  Event.MESSAGE_SET_TOP,
  async ({
    message,
    isTop,
    operator
  }) => {

    if (
      conversationTools.isSameConversation(
        message,
        state
      )
    ) {

      let {
        conversationId,
        conversationType,
        messageId
      } = message;

      juggle
        .getMessagesByIds({
          conversationType,
          conversationId,
          messageIds: [
            messageId
          ]
        })
        .then(
          ({
            messages = []
          }) => {

            let msg =
              messages[0];

            let result =
              conversationTools.updateLocalTopMsg(
                isTop,
                msg,
                operator
              );

            state.pinnedMessage =
              result;

          }
        );
    }
  }
);


juggle.once(
  Event.MESSAGE_READ,
  (notify) => {

    if (
      conversationTools.isSameConversation(
        notify,
        state
      )
    ) {

      let {
        messages
      } = notify;

      utils.forEach(
        messages,
        (result) => {

          let {
            messageId,
            readCount,
            unreadCount
          } = result;

          let index =
            utils.find(
              state.messages,
              (msg) => {
                return utils.isEqual(
                  msg.messageId,
                  messageId
                );
              }
            );

          if (index > -1) {

            let _msg =
              state.messages[index] ||
              {};

            if (
              conversationTools.isGroup(
                notify
              )
            ) {

              utils.extend(
                _msg,
                {
                  readCount,
                  unreadCount,
                  readPercent:
                    messageUtils
                      .getGroupReadPercent(
                        result
                      )
                }
              );

            } else {

              utils.extend(
                _msg,
                {
                  isRead: true
                }
              );

            }
          }
        }
      );
    }
  }
);


emitter.$on(
  EVENT_NAME.SEND_MESSAGE,
  (msg) => {

    state.messages.unshift(
      msg
    );

  }
);


/* =========================
   MESAJ GEÇMİŞİ
========================= */

let canscroll = true;

nextTick(() => {

  let {
    messages
  } = context.refs;

  if (!messages) {
    return;
  }

  messages.addEventListener(
    "scroll",
    () => {

      if (!canscroll) {
        return;
      }

      let scrollTop =
        messages.scrollTop;

      if (scrollTop < 300) {

        canscroll = false;

        let message =
          state.messages[0];

        if (!message) {

          canscroll = true;

          return;

        }

        let isFirst =
          false;

        conversationTools.getMessages(
          isFirst,
          () => {
            canscroll =
              true;
          },
          state,
          props
        );
      }
    }
  );
});


/* =========================
   GRUP ÜYELERİ
========================= */

emitter.$on(
  EVENT_NAME.ON_GROUP_MEMBER_ADDED,
  ({ members }) => {

    let {
      mentionMembers
    } = state;

    utils.forEach(
      members,
      (member) => {

        let _member =
          utils.clone(member);

        _member =
          utils.rename(
            _member,
            {
              user_id: "id",
              nickname: "name",
              avatar: "portrait"
            }
          );

        mentionMembers.push(
          _member
        );

      }
    );
  }
);


emitter.$on(
  EVENT_NAME.ON_GROUP_MEMBER_REMOVED,
  ({ members }) => {

    let {
      mentionMembers
    } = state;

    utils.forEach(
      members,
      (member) => {

        let index =
          utils.find(
            mentionMembers,
            (_member) => {
              return utils.isEqual(
                _member.id,
                member.id
              );
            }
          );

        if (index > -1) {
          mentionMembers.splice(
            index,
            1
          );
        }

      }
    );
  }
);


/* =========================
   SOHBET DEĞİŞİMİ
========================= */

watch(
  () => props.conversation,
  (
    newConversation,
    oldConversation
  ) => {

    if (oldConversation) {

      let {
        conversationId,
        conversationType
      } = oldConversation;

      emit(
        "ondraft",
        {
          conversationType,
          conversationId,
          draft:
            state.content
        }
      );

    }

    let draft =
      newConversation.draft ||
      "";

    utils.extend(
      state,
      {
        currentConversation:
          newConversation,

        messages: [],

        content:
          draft,

        isShowMobileBack:
          true,

        isShowAside:
          false
      }
    );

    onCancelReply();

    let isFirst =
      true;

    conversationTools.getMessages(
      isFirst,
      () => {
        scrollBottom();
      },
      state,
      props
    );

    conversationTools.getTopMessage(
      state,
      props.conversation
    );

  }
);


conversationTools.getTopMessage(
  state,
  props.conversation
);


conversationTools.getMessages(
  true,
  () => {
    scrollBottom();
  },
  state,
  props
);


/* =========================
   SCROLL
========================= */

function scrollBottom() {

  nextTick(() => {

    let {
      messages
    } = context.refs;

    if (messages) {

      messages.scrollTop =
        messages.scrollHeight;

    }

  });

}


/* =========================
   RESİM ÖNİZLEME
========================= */

function onPreviewImage(
  image
) {

  let messages =
    state.messages;

  let images = [];

  utils.forEach(
    messages,
    (message) => {

      if (
        utils.isEqual(
          message.name,
          MessageType.IMAGE
        )
      ) {

        let {
          content: {
            url
          }
        } = message;

        images.push(
          url
        );

      }

    }
  );

  let index =
    utils.find(
      images,
      (url) => {
        return utils.isEqual(
          url,
          image.url
        );
      }
    );

  preview({
    images,
    index
  });

}


/* =========================
   MENTION
========================= */

function onMentionSelected(
  index
) {

  let {
    mentionMembers,
    content,
    mentions
  } = state;

  let member =
    mentionMembers[index];

  if (!member) {
    return;
  }

  mentions.push(
    member
  );

  content +=
    `${member.name} `;

  utils.extend(
    state,
    {
      isShowMention:
        false,

      selectMentionIndex:
        0,

      mentions,

      content
    }
  );

}


/* =========================
   MESAJ GÖNDERME
========================= */

let isSending =
  false;


function onSend() {

  let {
    selectMentionIndex,
    mentions,
    isShowMention,
    content
  } = state;

  if (
    utils.isEmpty(
      content
    )
  ) {
    return;
  }

  if (
    isShowMention
  ) {

    onMentionSelected(
      selectMentionIndex
    );

    return;

  }

  let {
    conversation
  } = props;

  if (
    isSending
  ) {
    return;
  }

  isSending =
    true;

  let tid =
    utils.getUUID();

  let sender =
    juggle.getCurrentUser();

  let msg = {
    conversationType:
      conversation.conversationType,

    conversationId:
      conversation.conversationId,

    name:
      MessageType.TEXT,

    content: {
      content
    },

    isSender:
      true,

    tid,

    sender
  };

  let {
    currentReplyMessage
  } = state;

  if (
    !utils.isEmpty(
      currentReplyMessage
    )
  ) {

    utils.extend(
      msg,
      {
        referMsg:
          currentReplyMessage
      }
    );

  }

  if (
    conversationTools.isGroup(
      state.currentConversation
    )
  ) {

    let members =
      [];

    let mentionType =
      -1;

    let newContent =
      content;

    utils.forEach(
      mentions,
      (mention) => {

        let name =
          `@${mention.name} `;

        if (
          utils.isInclude(
            content,
            name
          )
        ) {

          if (
            !mention.isAll
          ) {

            members.push(
              mention
            );

          }

          newContent =
            newContent.replace(
              name,
              ""
            );

        }
      }
    );

    let isMentionSomeone =
      members.length > 0;

    if (
      isMentionSomeone
    ) {

      mentionType =
        MentionType.SOMEONE;

    }

    let isMentionAll =
      mentions.filter(
        (mention) => {
          return mention.isAll;
        }
      ).length > 0;

    if (
      isMentionAll
    ) {

      mentionType =
        MentionType.ALL;

    }

    if (
      isMentionAll &&
      isMentionSomeone
    ) {

      mentionType =
        MentionType.ALL_SOMEONE;

    }

    if (
      mentionType > -1
    ) {

      utils.extend(
        msg,
        {
          mentionInfo: {
            mentionType,
            members
          },

          content: {
            content:
              newContent
          },

          readCount: 0,

          unreadCount: 1
        }
      );

    }
  }

  utils.extend(
    state,
    {
      content: "",
      mentions: []
    }
  );

  state.draft = "";

  emit(
    "ondraft",
    {
      conversationType:
        conversation.conversationType,

      conversationId:
        conversation.conversationId,

      draft: ""
    }
  );

  onShowEmoji(
    false
  );

  scrollBottom();

  juggle
    .sendMessage(
      msg,
      {
        onbefore:
          (message) => {

            message.sentTime =
              Date.now();

            message.sentState =
              SentState.SENDING;

            message.streamMsg = {
              isEnd: false,
              streams: []
            };

            state.messages.unshift(
              message
            );

          }
      }
    )
    .then(
      ({
        sentTime,
        messageId
      }) => {

        utils.extend(
          msg,
          {
            sentTime,
            messageId
          }
        );

        isSending =
          false;

        let index =
          utils.find(
            state.messages,
            (m) => {
              return utils.isEqual(
                m.tid,
                msg.tid
              );
            }
          );

        let _msg =
          state.messages[index];

        if (_msg) {

          utils.extend(
            _msg,
            {
              sentTime,
              messageId,
              sentState:
                SentState.SUCCESS
            }
          );

        }

        onCancelReply();

      },
      ({
        error
      }) => {

        let index =
          utils.find(
            state.messages,
            (m) => {
              return utils.isEqual(
                m.tid,
                msg.tid
              );
            }
          );

        let _msg =
          state.messages[index];

        if (_msg) {

          utils.extend(
            _msg,
            {
              sentState:
                SentState.FAILED
            }
          );

        }

        context.proxy.$toast({
          text:
            `Mesaj gönderilemedi: ${error.code}`,

          icon:
            "error"
        });

        isSending =
          false;

      }
    );

}


/* =========================
   DOSYA / RESİM
========================= */

function onFileClick(e) {

  let parent =
    e.currentTarget.parentNode;

  let input =
    parent.querySelector(
      'input[type="file"]'
    );

  if (input) {
    input.click();
  }

}


function onFileChange(e) {

  let file =
    e.target.files[0];

  if (!file) {
    return;
  }

  let {
    conversation: {
      conversationId,
      conversationType
    }
  } = props;

  let message = {
    conversationType,
    conversationId,
    isSender: true,
    sender:
      juggle.getCurrentUser(),
    name:
      MessageType.FILE,
    percent: 0,
    tid:
      utils.getUUID()
  };

  let callback =
    () => {
      e.target.value =
        "";
    };

  if (
    utils.isEqual(
      file.type,
      "video/mp4"
    )
  ) {

    return conversationTools.sendVideo(
      file,
      message,
      callback,
      state
    );

  }

  if (
    utils.isInclude(
      [
        "image/png",
        "image/jpeg",
        "image/webp"
      ],
      file.type
    )
  ) {

    return sendImage(
      e
    );

  }

  conversationTools.sendFile(
    file,
    message,
    callback,
    state
  );

}


function sendImage(e) {

  let file =
    e.target.files[0];

  if (!file) {
    return;
  }

  let {
    conversation: {
      conversationId,
      conversationType
    }
  } = props;

  let url =
    URL.createObjectURL(
      file
    );

  let message = {
    conversationType,
    conversationId,
    isSender: true,
    sender:
      juggle.getCurrentUser(),
    name:
      MessageType.IMAGE,
    percent: 0,
    localUrl:
      url,
    tid:
      utils.getUUID()
  };

  let img =
    new Image();

  img.src =
    url;

  img.onload =
    function () {

      let content = {
        file,
        height:
          img.height,
        width:
          img.width,
        type:
          file.type
      };

      utils.extend(
        message,
        {
          content
        }
      );

      juggle
        .sendImageMessage(
          message,
          {
            onbefore:
              (msg) => {

                state.messages.unshift(
                  msg
                );

              },

            onprogress:
              ({
                percent
              }) => {

                let propMsg =
                  state.messages.filter(
                    (msg) => {
                      return utils.isEqual(
                        msg.tid,
                        message.tid
                      );
                    }
                  )[0];

                if (propMsg) {

                  utils.extend(
                    propMsg,
                    {
                      percent
                    }
                  );

                }
              }
          }
        )
        .then(
          ({
            tid,
            messageId,
            sentTime,
            content
          }) => {

            let propMsg =
              state.messages.filter(
                (msg) => {
                  return utils.isEqual(
                    msg.tid,
                    tid
                  );
                }
              )[0];

            if (propMsg) {

              utils.extend(
                propMsg,
                {
                  messageId,
                  sentTime,
                  content
                }
              );

            }

            e.target.value =
              "";

          },
          () => {

            context.proxy.$toast({
              text:
                "Resim gönderilemedi.",
              icon:
                "error"
            });

          }
        );
    };
}


/* =========================
   MESAJ İŞLEMLERİ
========================= */

function onRecall(message) {

  juggle
    .recallMessage(
      message
    )
    .then(
      (msg) => {

        let index =
          utils.find(
            state.messages,
            (_msg) => {
              return utils.isEqual(
                _msg.messageId,
                msg.content.messageId
              );
            }
          );

        if (index > -1) {

          state.messages.splice(
            index,
            1,
            msg
          );

        }

      }
    );

}


function onModifyText({
  message,
  content
}) {

  utils.extend(
    message,
    {
      content: {
        content
      },

      isUpdated:
        true
    }
  );

  let msg = {
    conversationType:
      message.conversationType,

    conversationId:
      message.conversationId,

    messageId:
      message.messageId,

    sentTime:
      message.sentTime,

    content: {
      content
    },

    tid:
      message.tid
  };

  juggle.updateMessage(
    msg
  );

}


function onInputDown() {

  conversationTools.updateMentionMember(
    "down",
    state
  );

  state.draft =
    state.content;

}


function onInputUp() {

  conversationTools.updateMentionMember(
    "up",
    state
  );

}


function onInputEsc() {

  utils.extend(
    state,
    {
      isShowMention:
        false,

      isShowTransfer:
        false
    }
  );

}


function onHideBack() {

  emit(
    "onback",
    {}
  );

  state.isShowMobileBack =
    false;

}


function onShowAside() {

  state.isShowAside =
    !state.isShowAside;

}


function onShowTransfer({
  type
}) {

  state.msgOpType =
    type;

  onCancelTransfer(
    true
  );

}


function onCancelTransfer(
  isShow
) {

  utils.forEach(
    state.transferMsgs,
    (msg) => {
      msg.isSelected =
        false;
    }
  );

  utils.extend(
    state,
    {
      isShowTransfer:
        isShow,

      transferMsgs: []
    }
  );

}


function onCancelTransferModal() {

  state.isShowTransferMember =
    false;

}


function onConfirmTranser({
  conversations
}) {

  let {
    transferMsgs,
    transferType
  } = state;

  conversationTools.transfer(
    transferType,
    conversations,
    transferMsgs,
    state
  );

  onCancelTransferModal();

  onCancelTransfer(
    false
  );

}


function onTransfer({
  type
}) {

  let {
    transferMsgs
  } = state;

  if (
    utils.isEmpty(
      transferMsgs
    )
  ) {

    return onCancelTransfer(
      false
    );

  }

  if (
    utils.isEqual(
      TRANSFER_TYPE.DELETE,
      type
    )
  ) {

    removeMessages(
      transferMsgs
    );

  } else {

    utils.extend(
      state,
      {
        isShowTransferMember:
          true,

        transferType:
          type
      }
    );

  }
}


function removeMessages(
  msgs
) {

  let _msgs =
    utils.map(
      msgs,
      (msg) => {

        let {
          conversationId,
          conversationType,
          tid,
          messageId,
          messageIndex,
          sentTime
        } = msg;

        return {
          conversationId,
          conversationType,
          tid,
          messageId,
          messageIndex,
          sentTime
        };

      }
    );

  juggle
    .removeMessages(
      _msgs
    )
    .then(
      () => {

        utils.forEach(
          _msgs,
          (msg) => {

            let index =
              utils.find(
                state.messages,
                (_msg) => {
                  return utils.isEqual(
                    _msg.tid,
                    msg.tid
                  );
                }
              );

            if (
              index > -1
            ) {

              state.messages.splice(
                index,
                1
              );

            }

          }
        );

      }
    );

  onCancelTransfer(
    false
  );

}


function onSelected(
  message
) {

  if (
    !state.isShowTransfer
  ) {
    return;
  }

  let {
    isSelected
  } = message;

  isSelected =
    !isSelected;

  message.isSelected =
    isSelected;

  if (
    isSelected
  ) {

    state.transferMsgs.push(
      message
    );

  } else {

    let index =
      utils.find(
        state.transferMsgs,
        (msg) => {
          return utils.isEqual(
            message.messageId,
            msg.messageId
          );
        }
      );

    if (
      index > -1
    ) {

      state.transferMsgs.splice(
        index,
        1
      );

    }
  }
}


function onMergeDetail(
  message
) {

  state.currentMergeMessage =
    message;

}


function onCancelMergeDetail() {

  state.currentMergeMessage =
    {};

}


function onCancelReply() {

  utils.extend(
    state,
    {
      currentReplyMessage:
        {},

      isShowReply:
        false
    }
  );

}


function onReply(
  message
) {

  let {
    messageInput
  } = context.refs;

  utils.extend(
    state,
    {
      currentReplyMessage:
        message,

      isShowReply:
        true
    }
  );

  if (messageInput) {
    messageInput.focus();
  }

}


/* =========================
   REACTION
========================= */

function onReaction(
  reaction
) {

  let {
    text,
    message
  } = reaction;

  let {
    conversationId,
    conversationType
  } =
    state.currentConversation;

  let {
    messageId
  } = message;

  message.reactions =
    message.reactions ||
    {};

  let list =
    message.reactions[text] ||
    [];

  let user =
    Storage.get(
      STORAGE.USER_TOKEN
    );

  let index =
    utils.find(
      list,
      (reaction) => {
        return (
          reaction.value ==
          user.id
        );
      }
    );

  let isRemove =
    index > -1;

  if (
    isRemove
  ) {

    list.splice(
      index,
      1
    );

    juggle.removeMessageReaction({
      conversationType,
      conversationId,
      messageId,
      reactionId:
        text
    });

  } else {

    list.push({
      key:
        text,

      value:
        user.id,

      user
    });

    juggle.addMessageReaction({
      conversationType,
      conversationId,
      messageId,
      reactionId:
        text
    });

  }

  if (
    utils.isEqual(
      list.length,
      0
    )
  ) {

    delete message.reactions[text];

  } else {

    message.reactions[text] =
      list;

  }

}


/* =========================
   EMOJİ / EKRAN GÖRÜNTÜSÜ
========================= */

function onPaste() {

  if (
    typeof JuggleIMDesktop !=
    "undefined"
  ) {

    let img =
      JuggleIMDesktop.readImage();

    if (
      !img.isEmpty()
    ) {

      let previewUrl =
        img.toDataURL();

      let imgData =
        img.toPNG();

      onShowImgSender({
        previewUrl,
        imgData
      });

    }
  }
}


function onShowEmoji(
  isShow
) {

  state.isShowEmoji =
    isShow;

}


function onChoiceEmoji(
  emoji
) {

  state.content +=
    emoji.text;

  inputFocus();

}


function onShowImgSender(
  img
) {

  state.imgSender =
    img;

}


function onConfirmImgSender() {

  let {
    imgSender
  } = state;

  let file =
    new window.File(
      [
        imgSender.imgData
      ],
      "screenshot.png",
      {
        type:
          "image/png"
      }
    );

  let e = {
    target: {
      files: [
        file
      ]
    }
  };

  sendImage(
    e
  );

  onShowImgSender(
    {}
  );

}


/* =========================
   ÜYELER
========================= */

function getMembers() {

  let {
    conversationType,
    conversationId,
    conversationTitle,
    conversationPortrait
  } =
    state.currentConversation;

  if (
    utils.isEqual(
      conversationType,
      ConversationType.PRIVATE
    )
  ) {

    utils.extend(
      state,
      {
        members: [
          {
            id:
              conversationId,

            name:
              conversationTitle,

            portrait:
              conversationPortrait
          }
        ]
      }
    );

    return;
  }

  Group.get(
    {
      id:
        conversationId
    },
    (result) => {

      state.group =
        result;

      let {
        group_mute
      } =
        result.group_management ||
        {};

      state.isShowGroupMute =
        !!group_mute;

      let {
        members
      } = result;

      members =
        members || [];

      let mentionMembers = [
        {
          id:
            "all",

          val:
            "@",

          isActive:
            true,

          name:
            "Herkes",

          portrait:
            "",

          isAll:
            true
        }
      ];

      members =
        utils.map(
          members,
          (member) => {

            let {
              user_id:
                id,

              nickname:
                name,

              avatar:
                portrait
            } = member;

            let item = {
              id,
              name,
              portrait
            };

            if (
              !portrait
            ) {

              item.portrait =
                common.getTextAvatar(
                  name,
                  {
                    height:
                      60,

                    width:
                      60
                  }
                );

            }

            mentionMembers.push(
              item
            );

            return item;

          }
        );

      utils.extend(
        state,
        {
          members,
          mentionMembers
        }
      );

    }
  );

}


/* =========================
   ARAMA / ÇAĞRI
========================= */

function onShowCall(
  isShow,
  mediaType
) {

  let user =
    juggle.getCurrentUser();

  let {
    currentConversation
  } = state;

  let members = [
    {
      id:
        user.id,

      name:
        user.name,

      portrait:
        user.portrait
    }
  ];

  let isMulti =
    conversationTools.isGroup(
      currentConversation
    );

  if (
    !isMulti
  ) {

    members.push({
      id:
        currentConversation.conversationId,

      name:
        currentConversation.conversationTitle,

      portrait:
        currentConversation.conversationPortrait
    });

  }

  emitter.$emit(
    EVENT_NAME.ON_SHOW_CALL_DIALOG,
    {
      isShow,
      members,
      isCall:
        true,
      mediaType,
      isMulti
    }
  );

}


getMembers();


watch(
  () =>
    state.currentConversation,

  () => {
    getMembers();
  }
);


watch(
  () =>
    props.conversation
      .conversationTitle,

  () => {

    onCancelTransfer(
      false
    );

    if (
      !utils.isMobile()
    ) {

      inputFocus();

    }

  }
);


nextTick(
  () => {

    if (
      !utils.isMobile()
    ) {

      inputFocus();

    }

    let {
      messageInput
    } = context.refs;

    if (
      messageInput
    ) {

      messageInput.addEventListener(
        "focusout",
        () => {
          window.scrollTo(
            0,
            0
          );
        }
      );

    }

  }
);


function inputFocus() {

  let {
    messageInput
  } = context.refs;

  if (
    messageInput
  ) {

    messageInput.focus();

  }

}


/* =========================
   TEKRAR GÖNDER
========================= */

function onResendMessage({
  message
}) {

  let index =
    utils.find(
      state.messages,
      (m) => {
        return utils.isEqual(
          m.tid,
          message.tid
        );
      }
    );

  let _msg =
    state.messages[index];

  juggle
    .sendMessage(
      message,
      {
        onbefore: () => {

          let msg =
            state.messages[index];

          if (
            msg
          ) {

            msg.sentState =
              SentState.SENDING;

          }

        }
      }
    )
    .then(
      ({
        sentTime,
        messageId
      }) => {

        if (
          _msg
        ) {

          utils.extend(
            _msg,
            {
              sentTime,
              messageId,
              sentState:
                SentState.SUCCESS
            }
          );

        }

      },
      ({
        error
      }) => {

        if (
          _msg
        ) {

          utils.extend(
            _msg,
            {
              sentState:
                SentState.FAILED
            }
          );

        }

        context.proxy.$toast({
          text:
            `Mesaj tekrar gönderilemedi: ${error.code}`,
          icon:
            "error"
        });

      }
    );

}


/* =========================
   SABİT / FAVORİ
========================= */

function onPinned({
  message
}) {

  conversationTools.setTopMessage(
    state,
    true,
    message
  );

}


function onFav({
  message
}) {

  conversationTools.addFavoriteMsg(
    message,
    (error) => {

      if (
        error
      ) {

        return context.proxy.$toast({
          text:
            `Favorilere eklenemedi: ${error.code}`,
          icon:
            "error"
        });

      }

      return context.proxy.$toast({
        text:
          "Mesaj favorilere eklendi.",
        icon:
          "success"
      });

    }
  );

}


function onUnpinned() {

  let {
    pinnedMessage
  } = state;

  if (
    utils.isEmpty(
      pinnedMessage
    )
  ) {
    return;
  }

  let {
    message
  } = pinnedMessage;

  conversationTools.setTopMessage(
    state,
    false,
    message
  );

}


/* =========================
   ODA AYARLARI
========================= */

function onClearMessages() {

  emit(
    "onclearmsg",
    props.conversation
  );

}


function onSetConversationTop(
  isTop
) {

  emit(
    "ontop",
    props.conversation,
    isTop
  );

}


function onConversationDisturb() {

  emit(
    "ondisturb",
    props.conversation
  );

}


function onQuitGroup() {

  emit(
    "onquitgroup",
    props.conversation
  );

}


function onBanGroup(
  isMute
) {

  state.isShowGroupMute =
    isMute;

  if (
    state.group &&
    state.group.group_management
  ) {

    state.group
      .group_management
      .group_mute =
        isMute;

  }

}


/* =========================
   AI
========================= */

function onAskAI() {

  if (
    state.isAsking
  ) {
    return;
  }

  state.isAsking =
    true;

  let {
    messages
  } = state;

  let msgs =
    [];

  for (
    let i = 0;
    i < messages.length;
    i++
  ) {

    let message =
      messages[i];

    if (
      utils.isEqual(
        message.name,
        MessageType.TEXT
      )
    ) {

      let {
        sender,
        content,
        sentTime
      } = message;

      msgs.push({
        sender_id:
          sender.id,

        content:
          content.content,

        msg_time:
          sentTime
      });

    }

    if (
      msgs.length >= 3
    ) {
      break;
    }
  }

  if (
    utils.isEqual(
      msgs.length,
      0
    )
  ) {

    state.isAsking =
      false;

    return context.proxy.$toast({
      text:
        "Bu sohbette AI'nin inceleyebileceği metin mesajı yok.",
      icon:
        "error"
    });

  }

  AI.answer({
    msgs
  }).then(
    (result) => {

      let {
        code,
        data
      } = result;

      state.isAsking =
        false;

      if (
        !utils.isEqual(
          code,
          RESPONSE.SUCCESS
        )
      ) {

        return context.proxy.$toast({
          text:
            `AI yanıt veremedi. Hata: ${code}`,
          icon:
            "error"
        });

      }

      state.content =
        data.answer;

    }
  );

}


/* =========================
   INPUT WATCH
========================= */

watch(
  () =>
    state.content,

  (val) => {

    let str =
      val.split("")[
        val.length - 1
      ];

    if (
      conversationTools.isGroup(
        state.currentConversation
      ) &&
      utils.isEqual(
        str,
        "@"
      )
    ) {

      utils.extend(
        state,
        {
          isShowMention:
            true
        }
      );

    } else {

      utils.extend(
        state,
        {
          isShowMention:
            false
        }
      );

    }

    if (
      utils.isEmpty(
        val
      )
    ) {

      onInputEsc();

    }
  }
);


/* =========================
   ÜYE ARAMA
========================= */

function filteredMembers() {

  let query =
    String(
      state.memberSearch ||
      ""
    )
      .toLowerCase()
      .trim();

  if (
    !query
  ) {

    return state.members;

  }

  return state.members.filter(
    (member) => {

      return String(
        member.name ||
        ""
      )
        .toLowerCase()
        .includes(
          query
        );

    }
  );

}
</script>


<template>

  <div
    class="chatovod-shell"
    :class="{
      'mobile-chat-open':
        state.isShowMobileBack &&
        utils.isMobile()
    }"
  >

    <!-- ANA SOHBET -->

    <main
      class="chatovod-main"
    >

      <!-- ÜST ODA BAŞLIĞI -->

      <header
        class="chatovod-header"
      >

        <div
          class="chatovod-header-left"
        >

          <button
            v-if="utils.isMobile()"
            class="chatovod-back-btn"
            @click="onHideBack"
          >
            ←
          </button>


          <div
            class="chatovod-room-avatar"
            :style="{
              'background-image':
                'url(' +
                props.conversation.conversationPortrait +
                ')'
            }"
          >
          </div>


          <div
            class="chatovod-room-info"
          >

            <div
              class="chatovod-room-title"
            >
              {{
                props.conversation
                  .conversationTitle
              }}
            </div>

            <div
              class="chatovod-room-meta"
            >
              {{ state.members.length }}
              üye
            </div>

          </div>

        </div>


        <div
          class="chatovod-header-actions"
        >

          <button
            class="chatovod-action-btn"
            title="AI"
            @click="onAskAI()"
          >
            🤖
          </button>


          <button
            v-if="
              !conversationTools.isGroup(
                state.currentConversation
              )
            "
            class="chatovod-action-btn"
            title="Sesli arama"
            @click="
              onShowCall(
                true,
                MediaType.AUDIO
              )
            "
          >
            🎤
          </button>


          <button
            class="chatovod-action-btn"
            title="Görüntülü arama"
            @click="
              onShowCall(
                true,
                MediaType.VIDEO
              )
            "
          >
            📹
          </button>


          <button
            class="chatovod-action-btn"
            title="Sohbet ayarları"
            @click="onShowAside"
          >
            ⚙️
          </button>

        </div>

      </header>


      <!-- SABİTLENMİŞ MESAJ -->

      <div
        class="chatovod-pinned"
        v-if="
          !utils.isEmpty(
            state.pinnedMessage
          )
        "
      >

        <div
          class="chatovod-pinned-icon"
        >
          📌
        </div>


        <div
          class="chatovod-pinned-text"
        >

          <strong>
            {{
              state.pinnedMessage
                .message.sender.name
            }}
          </strong>

          <span>
            {{
              state.pinnedMessage
                .shortName
            }}
          </span>

        </div>


        <button
          class="chatovod-pinned-close"
          @click.stop="onUnpinned"
        >
          ×
        </button>

      </div>


      <!-- MESAJLAR -->

      <section
        class="chatovod-messages"
        ref="messages"
      >

        <WithoutMessage
          v-if="state.isFinished"
        >
        </WithoutMessage>


        <div
          class="chatovod-message-list"
        >

          <div
            v-for="
              message in state.messages
            "
            :key="
              message.messageId ||
              message.tid
            "
            class="chatovod-message-row"
          >

            <TimelineMessage
              v-if="
                message.name ==
                'notify'
              "
              :message="message"
            >
            </TimelineMessage>


            <RecallMessage
              v-else-if="
                message.name ==
                MessageType.RECALL_INFO
              "
              :message="message"
            >
            </RecallMessage>


            <GroupNtfMessage
              v-else-if="
                message.name ==
                MSG_NAME.GROUP_NTF
              "
              :message="message"
            >
            </GroupNtfMessage>


            <FriendNtfMessage
              v-else-if="
                message.name ==
                MSG_NAME.FRIEND_NTF
              "
              :message="message"
            >
            </FriendNtfMessage>


            <div
              v-else
              class="chatovod-normal-message"
            >

              <span
                class="tyn-transfer wr"
                v-if="
                  state.isShowTransfer
                "
                :class="{
                  'wr-success-square':
                    message.isSelected,

                  'wr-square':
                    !message.isSelected
                }"
                @click="
                  onSelected(
                    message
                  )
                "
              >
              </span>


              <div
                class="chatovod-message-content"
                :class="{
                  'my-message':
                    message.isSender
                }"
                @click="
                  onSelected(
                    message
                  )
                "
              >

                <Text
                  v-if="
                    utils.isEqual(
                      message.name,
                      MessageType.TEXT
                    )
                  "
                  :message="message"
                  @onrecall="onRecall"
                  @onmodify="onModifyText"
                  @ontransfer="onShowTransfer"
                  @onreply="onReply"
                  @onreaction="onReaction"
                  @onresend="onResendMessage"
                  @onfav="onFav"
                  @onpinned="onPinned"
                >
                </Text>


                <ImageMessage
                  v-else-if="
                    utils.isEqual(
                      message.name,
                      MessageType.IMAGE
                    )
                  "
                  :message="message"
                  @onrecall="onRecall"
                  @onpreview="onPreviewImage"
                  @ontransfer="onShowTransfer"
                  @onreply="onReply"
                  @onreaction="onReaction"
                  @onfav="onFav"
                  @onpinned="onPinned"
                >
                </ImageMessage>


                <File
                  v-else-if="
                    utils.isEqual(
                      message.name,
                      MessageType.FILE
                    )
                  "
                  :message="message"
                  @onrecall="onRecall"
                  @ontransfer="onShowTransfer"
                  @onreply="onReply"
                  @onfav="onFav"
                  @onpinned="onPinned"
                >
                </File>


                <Video
                  v-else-if="
                    utils.isEqual(
                      message.name,
                      MessageType.VIDEO
                    )
                  "
                  :message="message"
                  @onrecall="onRecall"
                  @ontransfer="onShowTransfer"
                  @onreply="onReply"
                  @onreaction="onReaction"
                  @onfav="onFav"
                  @onpinned="onPinned"
                >
                </Video>


                <Merge
                  v-else-if="
                    utils.isEqual(
                      message.name,
                      MessageType.MERGE
                    )
                  "
                  :message="message"
                  @onrecall="onRecall"
                  @ondetail="onMergeDetail"
                  @ontransfer="onShowTransfer"
                  @onreply="onReply"
                  @onreaction="onReaction"
                  @onfav="onFav"
                  @onpinned="onPinned"
                >
                </Merge>


                <Call1v1FinishedMessage
                  v-else-if="
                    utils.isEqual(
                      message.name,
                      MessageType.CALL_1V1_FINISHED
                    )
                  "
                  :message="message"
                >
                </Call1v1FinishedMessage>


                <StreamText
                  v-else-if="
                    utils.isEqual(
                      message.name,
                      MessageType.STREAM_TEXT
                    )
                  "
                  :message="message"
                >
                </StreamText>


                <ContactCard
                  v-else-if="
                    utils.isEqual(
                      message.name,
                      MSG_NAME.CONTACT_CARD
                    )
                  "
                  :message="message"
                >
                </ContactCard>


                <Known
                  v-else
                  :message="message"
                >
                </Known>

              </div>

            </div>

          </div>

        </div>

      </section>


      <!-- MESAJ YAZMA -->

      <footer
        class="chatovod-composer"
      >

        <Mention
          :is-show="
            state.isShowMention
          "
          :members="
            state.mentionMembers
          "
          @onselected="
            onMentionSelected
          "
          :index="
            state.selectMentionIndex
          "
        />


        <Reply
          :is-show="
            state.isShowReply
          "
          @oncancel="
            onCancelReply
          "
          :message="
            state.currentReplyMessage
          "
        >
        </Reply>


        <Emoji
          :is-show="
            state.isShowEmoji
          "
          @onhide="
            onShowEmoji(false)
          "
          @onemit="
            onChoiceEmoji
          "
        >
        </Emoji>


        <div
          class="chatovod-input-row"
        >

          <button
            class="chatovod-tool-btn"
            title="Dosya veya resim gönder"
            @click="onFileClick"
          >
            📎
          </button>


          <input
            type="file"
            style="display:none"
            accept="image/*,video/mp4,.pdf,.zip,.txt,.doc,.docx"
            @change="onFileChange"
          />


          <input
            class="chatovod-input"
            v-model="
              state.content
            "
            @keydown.enter="
              onSend()
            "
            :disabled="
              state.isShowGroupMute ||
              state.isAsking
            "
            @keydown.esc="
              onInputEsc
            "
            @keydown.up.prevent="
              onInputUp
            "
            @keydown.down.prevent="
              onInputDown
            "
            @paste="
              onPaste
            "
            placeholder="Mesajınızı yazın..."
            ref="messageInput"
          />


          <button
            class="chatovod-tool-btn"
            title="Emoji"
            @click="
              onShowEmoji(true)
            "
          >
            😊
          </button>


          <button
            class="chatovod-send-btn"
            :disabled="
              !state.content.length
            "
            @click="
              onSend()
            "
          >
            Gönder
          </button>

        </div>


        <Transfer
          :is-show="
            state.isShowTransfer
          "
          :op-type="
            state.msgOpType
          "
          @oncancel="
            onCancelTransfer(false)
          "
          @ontransfer="
            onTransfer
          "
        >
        </Transfer>


        <div
          class="chatovod-warning"
          v-if="
            state.isShowGroupMute
          "
        >
          🔇 Bu odada mesaj gönderme geçici olarak kapatılmış.
        </div>


        <div
          class="chatovod-warning"
          v-if="
            state.isAsking
          "
        >
          🤖 AI son mesajları inceliyor...
        </div>

      </footer>

    </main>


    <!-- SAĞ ÜYELER -->

    <aside
      class="chatovod-members"
    >

      <div
        class="chatovod-members-header"
      >

        <div>
          ÜYELER
        </div>

        <span>
          {{
            state.members.length
          }}
        </span>

      </div>


      <div
        class="chatovod-members-search"
      >

        <input
          type="text"
          v-model="
            state.memberSearch
          "
          placeholder="Kullanıcı ara..."
        >

      </div>


      <div
        class="chatovod-member-section-title"
      >
        ODADAKİLER
      </div>


      <div
        class="chatovod-member-list"
      >

        <div
          v-for="
            member in filteredMembers()
          "
          :key="
            member.id
          "
          class="chatovod-member"
        >

          <div
            class="chatovod-member-avatar"
            :style="{
              'background-image':
                'url(' +
                member.portrait +
                ')'
            }"
          >
          </div>


          <div
            class="chatovod-member-data"
          >

            <div
              class="chatovod-member-name"
            >
              {{
                member.name
              }}
            </div>

            <div
              class="chatovod-member-status"
            >
              ● Online
            </div>

          </div>

        </div>


        <div
          v-if="
            filteredMembers().length ===
            0
          "
          class="chatovod-empty-members"
        >
          Kullanıcı bulunamadı.
        </div>

      </div>

    </aside>


    <!-- ESKİ AYAR PANELİ -->

    <ConversationAsider
      :is-show="
        state.isShowAside
      "
      :conversation="
        props.conversation
      "
      :members="
        state.members
      "
      :group="
        state.group
      "
      @ontop="
        onSetConversationTop
      "
      @ondisturb="
        onConversationDisturb
      "
      @onclearmsg="
        onClearMessages
      "
      @onquitgroup="
        onQuitGroup
      "
      @onbangroup="
        onBanGroup
      "
      @oncancel="
        onShowAside
      "
    >
    </ConversationAsider>


    <ModalTransfer
      :is-show="
        state.isShowTransferMember
      "
      @oncancel="
        onCancelTransferModal
      "
      @onconfirm="
        onConfirmTranser
      "
    >
    </ModalTransfer>


    <ModalMergeMsgs
      :is-show="
        !utils.isEmpty(
          state.currentMergeMessage
        )
      "
      :message="
        state.currentMergeMessage
      "
      @oncancel="
        onCancelMergeDetail
      "
    >
    </ModalMergeMsgs>


    <ModalImgSender
      :is-show="
        !utils.isEmpty(
          state.imgSender
        )
      "
      :img="
        state.imgSender
      "
      :conversation="
        state.currentConversation
      "
      @oncancel="
        onShowImgSender({})
      "
      @onconfirm="
        onConfirmImgSender
      "
    >
    </ModalImgSender>

  </div>

</template>


<style scoped>

.chatovod-shell {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #eef1f5;
  overflow: hidden;
  font-family:
    Arial,
    Helvetica,
    sans-serif;
}


/* =========================
   ANA SOHBET
========================= */

.chatovod-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}


/* =========================
   ÜST BAR
========================= */

.chatovod-header {
  height: 62px;
  min-height: 62px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border-bottom:
    1px solid #d9dee6;
  background: #f8f9fb;
}

.chatovod-header-left {
  display: flex;
  align-items: center;
  min-width: 0;
}

.chatovod-back-btn {
  border: 0;
  background: transparent;
  font-size: 24px;
  margin-right: 8px;
  cursor: pointer;
}

.chatovod-room-avatar {
  width: 38px;
  height: 38px;
  border-radius: 5px;
  background-size: cover;
  background-position: center;
  background-color: #dce3ec;
  flex: 0 0 auto;
}

.chatovod-room-info {
  margin-left: 10px;
  min-width: 0;
}

.chatovod-room-title {
  font-size: 15px;
  font-weight: 700;
  color: #20242a;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.chatovod-room-meta {
  margin-top: 3px;
  color: #7b8491;
  font-size: 12px;
}

.chatovod-header-actions {
  margin-left: auto;
  display: flex;
  gap: 5px;
}

.chatovod-action-btn {
  width: 36px;
  height: 36px;
  border:
    1px solid #d7dce4;
  background: #ffffff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.chatovod-action-btn:hover {
  background: #edf1f6;
}


/* =========================
   SABİTLENMİŞ MESAJ
========================= */

.chatovod-pinned {
  min-height: 40px;
  padding: 7px 12px;
  display: flex;
  align-items: center;
  border-bottom:
    1px solid #e3e6eb;
  background: #fff9df;
}

.chatovod-pinned-icon {
  margin-right: 8px;
}

.chatovod-pinned-text {
  display: flex;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  overflow: hidden;
}

.chatovod-pinned-text span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.chatovod-pinned-close {
  margin-left: auto;
  border: 0;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
}


/* =========================
   MESAJLAR
========================= */

.chatovod-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: #ffffff;
  padding: 8px 12px;
}

.chatovod-message-list {
  width: 100%;
}

.chatovod-message-row {
  width: 100%;
}

.chatovod-normal-message {
  width: 100%;
}

.chatovod-message-content {
  width: 100%;
  margin: 1px 0;
}


/* Juggle baloncuklarını daha klasik chat görünümüne yaklaştır */

.chatovod-message-content
:deep(.tyn-reply-item) {
  max-width: 100%;
}

.chatovod-message-content
:deep(.tyn-reply-bubble) {
  border-radius: 4px !important;
  box-shadow: none !important;
}

.chatovod-message-content
:deep(.tyn-reply-text) {
  font-size: 14px;
}

.chatovod-message-content
:deep(.tyn-reply-avatar) {
  width: 32px;
  height: 32px;
}


/* =========================
   MESAJ YAZMA
========================= */

.chatovod-composer {
  border-top:
    1px solid #d9dee6;
  background: #f8f9fb;
  padding: 9px;
}

.chatovod-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.chatovod-input {
  flex: 1;
  min-width: 0;
  height: 42px;
  border:
    1px solid #cdd3dc;
  border-radius: 4px;
  padding: 0 12px;
  outline: none;
  background: #ffffff;
  color: #222222;
  font-size: 14px;
}

.chatovod-input:focus {
  border-color: #477fc6;
}

.chatovod-tool-btn {
  width: 40px;
  height: 40px;
  border:
    1px solid #d3d8df;
  background: #ffffff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 18px;
}

.chatovod-tool-btn:hover {
  background: #edf1f6;
}

.chatovod-send-btn {
  height: 40px;
  padding: 0 18px;
  border: 0;
  border-radius: 4px;
  background: #3578c7;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
}

.chatovod-send-btn:hover {
  background: #2867b2;
}

.chatovod-send-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.chatovod-warning {
  margin-top: 7px;
  padding: 7px;
  border-radius: 3px;
  background: #fff2cf;
  color: #785c10;
  font-size: 12px;
}


/* =========================
   ÜYE PANELİ
========================= */

.chatovod-members {
  width: 235px;
  min-width: 235px;
  border-left:
    1px solid #d9dee6;
  background: #f7f8fa;
  display: flex;
  flex-direction: column;
}

.chatovod-members-header {
  height: 48px;
  min-height: 48px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content:
    space-between;
  border-bottom:
    1px solid #d9dee6;
  font-size: 12px;
  font-weight: 700;
  color: #545d69;
}

.chatovod-members-search {
  padding: 8px;
}

.chatovod-members-search input {
  width: 100%;
  height: 34px;
  border:
    1px solid #d4d9e0;
  border-radius: 3px;
  padding: 0 9px;
  outline: none;
  font-size: 12px;
}

.chatovod-members-search
input:focus {
  border-color: #477fc6;
}

.chatovod-member-section-title {
  padding:
    8px 12px 5px;
  font-size: 10px;
  font-weight: 700;
  color: #8b929c;
}

.chatovod-member-list {
  overflow-y: auto;
  flex: 1;
}

.chatovod-member {
  min-height: 48px;
  display: flex;
  align-items: center;
  padding: 5px 10px;
  cursor: pointer;
}

.chatovod-member:hover {
  background: #e8ebef;
}

.chatovod-member-avatar {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border-radius: 50%;
  background-position:
    center;
  background-size:
    cover;
  background-color:
    #dce1e8;
}

.chatovod-member-data {
  margin-left: 8px;
  min-width: 0;
}

.chatovod-member-name {
  font-size: 13px;
  font-weight: 600;
  color: #252a31;
  overflow: hidden;
  text-overflow:
    ellipsis;
  white-space:
    nowrap;
}

.chatovod-member-status {
  margin-top: 2px;
  font-size: 10px;
  color: #30a14e;
}

.chatovod-empty-members {
  padding: 15px;
  color: #8a929d;
  font-size: 12px;
  text-align: center;
}


/* =========================
   SCROLLBAR
========================= */

.chatovod-messages::-webkit-scrollbar,
.chatovod-member-list::-webkit-scrollbar {
  width: 7px;
}

.chatovod-messages::-webkit-scrollbar-thumb,
.chatovod-member-list::-webkit-scrollbar-thumb {
  background: #c5cad2;
  border-radius: 5px;
}


/* =========================
   MOBİL
========================= */

@media (
  max-width: 767px
) {

  .chatovod-shell {
    width: 100%;
    height: 100%;
  }

  .chatovod-members {
    display: none;
  }

  .chatovod-header {
    height: 56px;
    min-height: 56px;
    padding: 0 8px;
  }

  .chatovod-room-avatar {
    width: 34px;
    height: 34px;
  }

  .chatovod-room-title {
    font-size: 14px;
  }

  .chatovod-header-actions {
    gap: 2px;
  }

  .chatovod-action-btn {
    width: 31px;
    height: 31px;
    font-size: 14px;
  }

  .chatovod-messages {
    padding: 5px 7px;
  }

  .chatovod-composer {
    padding: 6px;
  }

  .chatovod-input-row {
    gap: 4px;
  }

  .chatovod-input {
    height: 42px;
    padding: 0 8px;
    font-size: 13px;
  }

  .chatovod-tool-btn {
    width: 36px;
    min-width: 36px;
    height: 40px;
    font-size: 17px;
  }

  .chatovod-send-btn {
    height: 40px;
    padding: 0 11px;
    font-size: 12px;
  }

}


/* Çok küçük telefon */

@media (
  max-width: 380px
) {

  .chatovod-action-btn:nth-child(1) {
    display: none;
  }

  .chatovod-send-btn {
    padding: 0 8px;
  }

}
</style>
