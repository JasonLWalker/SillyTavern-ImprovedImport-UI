'use strict';
import { 
    Popup,
    callGenericPopup, 
    POPUP_TYPE
} from "../../../popup.js";

import { 
    getExtensionSettings, 
    changeTab,
    encodeToB64,
    decodeFromB64, 
    extensionName,
    log,
    pleasewaitHtml,
    uploadAvatarHtml, 
    closePopup,
    importCard,
    getV1CardTemplate,
    replacePlaceholders
} from "./util.js";

import {
    getBase64Async
} from "../../../utils.js"

const storyItemHtml = `
<div class="story-container">
    <div class="avatar"><img src="/img/ai4.png" /></div>
    <div class="story-item">
        <div class="flex-container">
            <h3>
                {story_heading}
            </h3>
            <div class="form_create_bottom_buttons_block">
                <div title="Download Character Card" data-storyid="{story_id}" data-i18n="[title]Download Character Card" class="menu_button fa-solid fa-download faSmallFontSquareFix"></div>
                <div title="Import Character" data-storyid="{story_id}" data-i18n="[title]Import Character" class="menu_button fa-solid fa-cloud-arrow-down faSmallFontSquareFix"></div>
            </div>
        </div>
        <div class="">{story_body}</div>
    </div>
</div>
<hr />
`;

const novelaiLoginHtml = `
<div id="improvedimport-nai-login" class="justifyLeft">
    <p>Your NovelAI stories and content cannot be accessed by the normal methods used by SillyTavern. </p>
    <p>These can only be retrieved by using your NovelAI username and password to generate Access and Encryption Keys. We will not store your login or password in any way. They are only used to generate the hashed tokens used to log in to NovelAI and retrieve your story information.</p>
    <div class="login-form" >
        <div class="justifyLeft">
            <label>NovelAI Email</label><br />
            <input text="text" name="nai-username" placeholder="Username" class="text ui-widget-content ui-corner-all" />
        </div>
        <div class="justifyLeft">
            <label>NovelAI Password</label><br />
            <input text="text" name="nai-password" placeholder="Password" class="text ui-widget-content ui-corner-all" />
        </div>
        <button type="button" name="nai-login" class="menu_button">Login to NovelAI</button>
    </div>
</div>
`;

const novelaiMain = `
    <div class>
        <div class="action-menu">
            <button type="button" name="nai-logout" class="menu_button nowrap">
                <img src="/img/novel.svg" style="height:.8em; filter: brightness(0%) saturate(100%) invert(100%); margin-right:5px" />
                Logout of NovelAI
            </button>
        </div>
        <div><hr /></div>
        <div class="story-list">
        </div>
    </div>
`;

const uriEndpoint = `/api/plugins/${extensionName}/novelai`;

async function authenticateUser(l, k) {
    return await $.ajax({
        type: "POST",
        url: uriEndpoint + '/login',
        contentType: 'application/json',
        data: JSON.stringify({token:encodeToB64({l:l, k:k})})
    });
} 

async function onLogout(event) {
    return await $.ajax({
        type: "get",
        url: uriEndpoint + '/logout',
        contentType: 'application/json'
    }).always(function(evt){
        changeTab(event, novelaiLoginHtml);
    });
}

export async function getStories() {
    return await $.ajax({
        type: "get",
        url: uriEndpoint + '/stories',
        contentType: 'application/json'
    });
}

async function onDownloadCard(event) {
    var $elem = $(event.delegateTarget);
    var card = await $.ajax({
        type: "get",
        url: uriEndpoint + '/v1card/' + $elem.data('storyid'),
        contentType: 'application/json'
    });
    
    var element = document.createElement('a');
    element.setAttribute('href', 'data:octet/stream;charset=utf-16le;base64,' + btoa(card));
    element.setAttribute('download', card['title'] + '.json');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

async function onImportCard(event) {
    var $elem = $(event.delegateTarget);
    var card = await $.ajax({
        type: "get",
        url: uriEndpoint + '/v2card/' + $elem.data('storyid'),
        contentType: 'application/json'
    });
    closePopup();

    const popup = new Popup(uploadAvatarHtml, POPUP_TYPE.INPUT, '', {wide: false, large: false, allowHorizontalScrolling: true, okButton: 'Import', cancelButton: 'Cancel'});
    var $files = $('input[name=improvedimport-avatar-image]', $(popup.dlg));
    $files.off().on('change', async function(event){
        const fileData = await getBase64Async(event.delegateTarget.files[0]);
        $('#improvedimport_avatar_load_preview').attr('src', fileData);
        $(popup.input).val(fileData);
    });
    $(popup.cancel).css('display', 'inline-block');
    $(popup.input).css('display', 'none');
    let popupPromise = popup.show();
    $('#improvedimport_avatar_load_preview').off().on('click', function(){
        $files.trigger('click');
    });
    let result = await popupPromise;
    closePopup();
    if (popup.value !== false){
        card = JSON.parse(replacePlaceholders(JSON.stringify(card)));
        importCard(card, result, null);
    }
}

async function loadStories(event) {
    try{
        changeTab(event, pleasewaitHtml); 
        var stories = await getStories();
        changeTab(event, novelaiMain); 
        $('#improvedimport-main .action-menu button[name=nai-logout]').off().on('click', onLogout);
        var $tabContent = $('#improvedimport-main .story-list');
        for(var k in stories) {
            var story = stories[k];
            var storyData = story['data'];
            var content = storyItemHtml.replace('{story_heading}', storyData['title']).replaceAll('{story_id}', story['id']).replace('{story_body}', storyData['description'] || storyData['textPreview']);
            $tabContent.append($(content));
        }
        $('.fa-download', $tabContent).off().on('click', onDownloadCard);
        $('.fa-cloud-arrow-down', $tabContent).off().on('click', onImportCard);
    }
    catch (ex) 
    {
        log(ex);
        changeTab(event, novelaiLoginHtml);
        $('#improvedimport-nai-login button[name=nai-login]').off().on('click', async function(event){
            var data = await authenticateUser($('#improvedimport-nai-login input[name=nai-username]').val(), $('#improvedimport-nai-login input[name=nai-password]').val());
            onClickNovelAiTab(event);
        });
    }
}

export async function onClickNovelAiTab(event) {

    loadStories(event);
    return false;
}

function isNovelAiScenario(jsonObj) {
    return ('scenarioVersion' in jsonObj && 'prompt' in jsonObj) 
        return true;

    return false;
}

function getContextText(jsonObj) {
    if (jsonObj['context'] && typeof(jsonObj) == 'object')     
    {
        let context = jsonObj.context;
        let arryText = [];
        let s = '';
        for (let k in context) {
            let ctx = context[k];
            if (ctx['text']) {
                var obj = {text: ctx.text, order: 0};
                if (ctx['contextConfig']) {
                    if (ctx.contextConfig['insertionPosition']){
                        obj.order = ctx.contextConfig.insertionPosition; 
                    } else if (ctx.contextConfig['budgetPriority']) {
                        obj.order = ctx.contextConfig.budgetPriority;
                    }
                }
                arryText.push(obj);
            }
        }
        if (arryText.length > 0) {
            arryText.sort(function(a, b){
                return (a.order > b.order) - (a.order < b.order);
            });

            for (let i = 0; i < arryText.length; i++) {
                s += arryText[i].text;
            }
        }
        return s;
    }
    return '';
}

export function tryNovelAiToV1(jsonObj) {
    if (isNovelAiScenario(jsonObj))
    {
        // object is likely a NovelAi scenario
        let card = getV1CardTemplate();
        card.name = jsonObj['title'];
        //card.description = jsonObj['description'];
        card.scenario = getContextText(jsonObj);
        card.first_mes = jsonObj['prompt'];
        return card;
    }
}

export function tryNovelAiToV2(jsonObj) {
    if (isNovelAiScenario(jsonObj))
    {
        console.log(jsonObj);

        // object is likely a NovelAi scenario
        var card = getV2CardTemplate();
        var data = card.data;

        // Populate V1 data
        data.name = jsonObj['title'];
        //card.description = jsonObj['description'];
        data.scenario = getContextText(jsonObj);
        data.first_mes = jsonObj['prompt'];

        // V2 fields
        data.creator_notes = jsonObj['description'];

        if (jsonObj['tags']) {
            for (let i=0;i<jsonObj.tags.length;i++) {
                data.tags.push(jsonObj.tags[i]);
            }
        }


        return card;
    }
    
}
