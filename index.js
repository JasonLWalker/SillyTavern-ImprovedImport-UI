import { 
    callGenericPopup, 
    POPUP_TYPE
} from "../../../popup.js";

import { 
    initExtensionSettings, 
    getExtensionSettings, 
    onHandleSettingsCheckbox,
    changeTab, 
    log,
    settingsHtml,
    infoHtml,
    closePopup,
    replacePlaceholders
} from "./util.js";

import {
    getBase64Async,
    getFileBuffer
} from "../../../utils.js"

import { onClickNovelAiTab, tryNovelAiToV1 } from "./novelai.js";

const mainHtml = `
<div id="improvedimport-main" class="">
    <h3>Import new character</h3>
    <hr />
    <ul class="nav nav-tabs">
        <li class="nav-item">
            <a class="nav-link active nav-tab-info" href="#">Info</a>
        </li>
        <li class="nav-item nav-item-novelai">
            <a class="nav-link nav-tab-novelai" href="#"><img src="/img/novel.svg" style="height:.8em; filter: brightness(0%) saturate(100%) invert(100%); margin-right:5px" />NovelAI</a>
        </li>
        <li class="nav-item d-none">
            <a class="nav-link nav-tab-chub" href="#">CHub</a>
        </li>
        <li class="nav-item d-none">
            <a class="nav-link nav-tab-aids" href="#">AIDS</a>
        </li>
        <li class="nav-item d-none">
            <a class="nav-link nav-tab-janitorai" href="#">JanitorAI</a>
        </li>
        <li class="nav-item d-none">
            <a class="nav-link nav-tab-aicc" href="#">AICC</a>
        </li>
        <li class="nav-item nav-item-file">
            <a class="nav-link nav-tab-file" href="#"><span class="fa-solid fa-file-import"></span> File</a>
        </li>
        <li class="nav-item nav-item-web">
            <a class="nav-link nav-tab-web" href="#"><span class="fa-solid fa-cloud-arrow-down"></span> Web</a>
        </li>
    </ul>
    <div class="tab-content">
        ${infoHtml}
    </div>
</div>
`;

function enablePlugin(enabled) {
    // remove any existing plugin button from UI
    $('#improvedimport_button').remove();

    if (enabled) {
        // Hide original import buttons
        $('#character_import_button, #external_import_button').addClass('d-none');

        // Create new plugin button and append to UI
        var $btn = $('<div id="improvedimport_button" title="Import Character" data-i18n="[title]Import Character" class="menu_button fa-solid fa-cloud-arrow-down faSmallFontSquareFix"></div>')
        $('#rm_button_create').after($btn);

        // Add button event handler
        $btn.on('click', onImportCharacterButton);
    } else {
        // Show original import buttons
        $('#character_import_button, #external_import_button').removeClass('d-none');
    }
}

async function onImportCharacterButton(event) {
    const popup = callGenericPopup(mainHtml, POPUP_TYPE.TEXT, '', {wide: true, large: true, allowHorizontalScrolling: true, okButton: 'Close'});
    var settings = getExtensionSettings();
    //log(settings);
    document.getElementById("character_import_file").value = null;
    document.getElementById("improvedimport-choose-file").value = null;

    if(!settings['originalFileEnabled']) $('#improvedimport-main .nav-item-file').addClass('d-none');
    if(!settings['originalExternalEnabled']) $('#improvedimport-main .nav-item-web').addClass('d-none');
    if(!settings['novelAiEnabled']) $('#improvedimport-main .nav-item-novelai').addClass('d-none');

    $('#improvedimport-choose-file').off().on('change', async function(event){
        const fileChooser = document.querySelector('#improvedimport-choose-file');
        let origFile = fileChooser.files[0];
        var fileData = await getFileBuffer(origFile);
        let fileFormat = origFile.type;

        if (fileFormat.indexOf('image', 0) > -1) {
            /*
            // process via original file import
            let file = new File([fileData], origFile.name, {type: fileFormat});
            let container = new DataTransfer(); 
            container.items.add(file);
            document.querySelector('#character_import_file').files = container.files;
            await $('#character_import_file').trigger('change');
            */ 
        }

        if (fileFormat.indexOf('application/json', 0) > -1) {
            // Determine the type of scenario/card file
            var s = (new TextDecoder("utf-8")).decode(fileData);
            jObj = JSON.parse(replacePlaceholders(s, []));
            //var jObj = JSON.parse();
            //console.log(jObj);
            //JSON.parse(replacePlaceholders(JSON.stringify(card)));
            var card = tryNovelAiToV2(jObj);
            if (card) {
                log(card);
                fileData = JSON.stringify(card);//(new TextEncoder()).encode(JSON.stringify(card));
            }
        }


        // process via original file import
        try {
            let file = new File([fileData], origFile.name, {type: fileFormat});
            let container = new DataTransfer(); 
            container.items.add(file);
            document.querySelector('#character_import_file').files = container.files;
            await $('#character_import_file').trigger('change'); 
        } catch {
            toastr.warning("Unable to import character", "Unable to parse character file");
        }

        log(fileFormat, fileData, document.querySelector('#character_import_file').files[0]);

        closePopup();
    });

    $('#improvedimport-main .nav-tab-info')
        .off()
        .on('click', function(event) { 
            return changeTab(event, infoHtml);
        });
    $('#improvedimport-main .nav-tab-novelai')
        .off()
        .on('click', onClickNovelAiTab);

    $('#improvedimport-main .nav-tab-file').off().on('click', function(event) { 
        closePopup(); 
        $('#improvedimport-choose-file').trigger('click'); 
        return false; 
    });
    
    $('#improvedimport-main .nav-tab-web').off().on('click', function(event){ 
        closePopup(); 
        $('#external_import_button').trigger('click'); 
        return false; 
    });

    //var result = await popup;
}

function loadSettings() {
    //Create the settings if they don't exist

    const extensionSettings = initExtensionSettings();
    
    // Updating settings in the UI
    
    // Set the checkbox for enabling the plugin
    $("#improvedimport-enabled").prop("checked", extensionSettings['enabled']);
    // Set the checkbox for enabling the original file import checkbox
    $("#improvedimport-origfile-enabled").prop("checked", extensionSettings['originalFileEnabled']);
    // Set the checkbox for enabling the original external import checkbox
    $("#improvedimport-origexternal-enabled").prop("checked", extensionSettings['originalExternalEnabled']);

    // Set the checkbox for enabling the novelai checkbox
    $("#improvedimport-nai-enabled").prop("checked", extensionSettings['novelAiEnabled']);
    
    enablePlugin(extensionSettings['enabled']);
}

// This function is called when the extension is loaded
jQuery(async () => {
    var extensionSettings = getExtensionSettings();
    // Loads the extension settings if they exist, otherwise initializes them to the defaults.
    enablePlugin(extensionSettings['enabled']);

    // Append settingsHtml to extensions_settings
    // extension_settings and extensions_settings2 are the left and right columns of the settings menu
    // Left should be extensions that deal with system functions and right should be visual/UI related 
    $("#extensions_settings").append(settingsHtml);

    // Add settings control handlers
    $("#improvedimport-enabled").off().on('input', function(event) { 
        onHandleSettingsCheckbox(event);
        var extensionSettings = getExtensionSettings();
        enablePlugin(extensionSettings['enabled']);
    });
    $("#improvedimport-origfile-enabled").off().on('input', onHandleSettingsCheckbox);
    $("#improvedimport-origexternal-enabled").off().on('input', onHandleSettingsCheckbox);
    $("#improvedimport-nai-enabled").off().on('input', onHandleSettingsCheckbox);

    // Load settings when starting things up (if you have any)
    loadSettings();
});