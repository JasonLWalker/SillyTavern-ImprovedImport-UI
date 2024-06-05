import { extension_settings } from "../../../extensions.js";
import { 
    processDroppedFiles, 
    saveSettingsDebounced 
} from "../../../../script.js";
import {
    ensureImageFormatSupported,
    convertImageFile,
    createThumbnail
} from "../../../utils.js"



const _VERBOSE = true;

export const extensionName = "improvedimport";
const uriEndpoint = `/api/plugins/${extensionName}`;
export const log = (...msg) => _VERBOSE ? console.log('[' + extensionName + ']', ...msg) : null;
export const warn = (...msg) => _VERBOSE ? console.warn('[' + extensionName + ']', ...msg) : null;
export const pleasewaitHtml = `
<div>
    Loading, please wait...
</div>
`;
export const settingsHtml = `
<div class="improvedimport-extension-settings">
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>Improved Import/Export</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div class="improvedimport-extension_block flex-container">
                <input id="improvedimport-enabled" type="checkbox" data-setting="enabled" />
                <label for="improvedimport-enabled">Enable Improved Import</label>
            </div>
            <div class="improvedimport-extension_block flex-container">
                <input id="improvedimport-origfile-enabled" type="checkbox" data-setting="originalFileEnabled" />
                <label for="improvedimport-origfile-enabled">Enable Original File Import</label>
            </div>
            <div class="improvedimport-extension_block flex-container">
                <input id="improvedimport-origexternal-enabled" type="checkbox" data-setting="originalExternalEnabled" />
                <label for="improvedimport-origexternal-enabled">Enable Original External Import</label>
            </div>
            <div class="improvedimport-extension_block flex-container">
                <input id="improvedimport-nai-enabled" type="checkbox" data-setting="novelAiEnabled" />
                <label for="improvedimport-nai-enabled">Enable NovelAI Import</label>
            </div>
            <hr class="sysHR" />
        </div>
    </div>
    <div style="display:none">
        <input type="file" id="improvedimport-choose-file" />
    </div>
</div>
`;
export const infoHtml = `
    <p>Please select an option from the tabs above.</p>
`;

export const uploadAvatarHtml = `
<div id="improvedimport-chooseimage">
    <div class="story-container">
        <div class="avatar">
            <img id="improvedimport_avatar_load_preview" src="img/ai4.png" alt="avatar">
        </div>
        <div class="story-item">
            <p>Please (optionally) choose an image file to use as an avatar for this character card.</p>
            <div class="d-none">
                <input type="file" name="improvedimport-avatar-image" style="display:inline;"  accept=".png, .jpg, .jpeg, .tiff, .tif, .webp, .gif, .bmp"/>
            </div>
        </div>
    </div>
</div>
`;

const defaultSettings = {
    enabled: false,
    originalFileEnabled: true,
    originalExternalEnabled: true,
    novelAiEnabled: false,
};

export function getExtensionSettings() {
    return extension_settings[extensionName] || {};
}

export function onHandleSettingsCheckbox(event) { 
    var $elem = $(event.delegateTarget);
    var keyName = $elem.data('setting');
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName][keyName] = value; 
    saveSettingsDebounced();
}

export function initExtensionSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    return extension_settings[extensionName];
}

export function changeTab(event, html) {
    //log(event.delegateTarget);
    $('#improvedimport-main .nav-link').removeClass('active');
    $(event.delegateTarget).addClass('active');

    $('#improvedimport-main .tab-content').empty().html(html);
    return false;
}

export function encodeToB64(obj) {
    return btoa(
        new Uint8Array(
            JSON
            .stringify(obj)
            .split('')
            .map(function (c) { return c.charCodeAt(0); })
        ));
}

export function decodeFromB64(data) {
    return JSON.parse(String.fromCharCode.apply(null, atob(data).split(',').map(function(n){ return Number(n);})));
}

export function closePopup() {
    $('#improvedimport-main').closest('.dialogue_popup_holder').find('.dialogue_popup_ok').trigger('click'); 
    return false;
}

export function getV1CardTemplate() {
    return {
        "name": "",
        "description": "",
        "personality": "",
        "scenario": "",
        "first_mes": "",
        "mes_example": ""
    };
}

export async function importCard(cardObj, b64Avatar) {
    try{    
        if (b64Avatar) {
            let avatarFile = await createThumbnail(b64Avatar, null, null, 'image/png');
            let imgData = await $.ajax({
                type: "post",
                url: uriEndpoint + '/mergecardavatar',
                contentType: 'application/json',
                data: JSON.stringify({
                    avatar: avatarFile,
                    card: cardObj
                })
            });
            
            let file = new File(
                [Uint8Array.from(atob(imgData), (m) => m.codePointAt(0))],
               (new Date()).valueOf() + '.png',
               { type: "image/png" }
            );
            return await processDroppedFiles([file], false);
        } else {
            let file = new File([JSON.stringify(cardObj)], (new Date()).valueOf() + ".json", {type: 'application/json'})
            return await processDroppedFiles([file], false);
        }

    } catch {
        toastr.warning('An error has occurred while importing the character card data or avatar image.');
    }
}