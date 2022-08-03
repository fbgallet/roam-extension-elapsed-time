import iziToast from 'izitoast';
import '../node_modules/izitoast/dist/css/iziToast.css';

iziToast.settings({
    close: false,
    icon: '',
    timeout: 8000,
    progressBar: true,
    layout: 2
  })
iziToast.show({
    title: 'Hey',
    message: 'Hello world!'
});

var totalTitle = "Total time: **(<th>)**"
var triggerTab = [];
var intervalSeparator = " - ";
var durationFormat = "(**<d>'**)"; 
var totalFormat = "<category>: **(<th>)** <limit>";
var limitFormat = "<flag> (<type>: <value>')";
var limitFlag = {
  task: {
    goal: {  success: '#.good-time',
             failure: '#.insufficient-time'},
    limit: { success: '#.good-time',
             failure: '#.exceeded-time'}},
  day: {
    goal: {  success: '🎯',
      		 failure: '⚠️'},
    limit: { success: '👍',
             failure: '🛑'}}
}

function getTreeByPageTitle(pageTitle) {
return window.roamAlphaAPI.q(`[:find ?uid ?s 
							   :where [?b :node/title "${pageTitle}"]
									  [?b :block/children ?cuid]
									  [?cuid :block/uid ?uid]
									  [?cuid :block/string ?s]]`);
}

function getChildrenTree(uid) {
  let q = `[:find (pull ?page
                       [:block/uid :block/string :block/children 
						{:block/children ...} ])
                    :where [?page :block/uid "${uid}"]  ]`;
  return window.roamAlphaAPI.q(q)[0][0].children;
}

function TriggerWord(s, uid, l, f) {
  this.word = this.getOnlyWord(s);
  this.uid = uid;
  this.display = true;
  this.limit = l;
  this.time = 0;
  this.format = f;
  this.children = [];
}
TriggerWord.prototype.addChildren = function(s,u,l,f) {
    return this.children.push(new TriggerWord(s,u,l,f));
}
TriggerWord.prototype.getOnlyWord = function(s) {  
  s = s.split('{')[0];
  return s.trim();
}

function getParameters() {
  let tree = getTreeByPageTitle('roam/js/smartblocks/TimeStamp Buttons and elapsed time calculator');
  for(let i=0; i<tree.length;i++) {
    let parentUid = tree[i][0];
    switch(tree[i][1]) {
        case('Categories'):
        	getTriggerWords(parentUid);
    		break;
        case('Duration format'):
        	getDurationFormat(parentUid);
        	break;
        case('Separator'):
        	getSeparator(parentUid);
        	break;
        case('Total format'):
        	getTotalFormat(parentUid);
        	break;
        case('Limit format'):
        	getLimitFormat(parentUid);
        	break;
        case('Limits flags'):
        	getLimitFlags(parentUid);
        	break;
    }
  }
}

function getDurationFormat(parentUid) {
  let tree = getChildrenTree(parentUid);
  if (tree) {
    durationFormat = tree[0].string;
  }
}

function getSeparator(parentUid) {
  let tree = getChildrenTree(parentUid);
  if (tree) {
    let intervalSeparator = tree[0].string;
  }
}

function getTotalFormat(parentUid) {
  let tree = getChildrenTree(parentUid);
  if (tree) {
    let f0 = tree[0].string;
    let f1 = tree[1].string;
    if (f0.includes("<category>")) {
    	totalFormat = f0;
    } else {totalTitle = f0}
    if (f1.includes("<category>")) {
    	totalFormat = f1;
    } else {totalTitle = f1}
  }
}

function getLimitFormat(parentUid) {
  let tree = getChildrenTree(parentUid);
  if (tree) {
    limitFormat = tree[0].string;
  }
}

function getTriggerWords(parentUid) {
  let triggerTree = getChildrenTree(parentUid);
        
  if (triggerTree) {
    for(let i=0; i<triggerTree.length;i++) {
      let w = triggerTree[i];
      let hide = false;
      if (w.string.includes('{hide}')) {
        hide = true;
        w.string = w.string.replace('{hide}','');
      }
      triggerTab.push(new TriggerWord(w.string, w.uid, null, ''));
      if (w.children) {
        for(let j=0; j<w.children.length;j++) {
            let hideSub = false;
            let t = w.children[j].string;
            if (t.includes('limit:') || t.includes('goal:')) {
              triggerTab[triggerTab.length-1].limit = getLimits(t);
            }
            else if (t.includes('format:')) {
              triggerTab[triggerTab.length-1].format = getFormat(t);
            }
          	else {
              if (t.includes('{hide}')) {
                t = t.replace('{hide}','');
                hideSub = true;
              }
              let format = '';
              let limit = null;
              if (w.children[j].children) {
                for(let k=0; k<w.children[j].children.length; k++) {
                  let childS = w.children[j].children[k].string;
                  if (childS.includes('limit:') || childS.includes('goal:')) {
             		 limit = getLimits(childS);
            		}
           		  else if (childS.includes('format:')) { format = getFormat(childS); }
                }
              }
              triggerTab[i].addChildren(t, w.children[j].uid, limit, format);
              if (hide || hideSub) { 
                triggerTab[i].children[triggerTab[i].children.length-1].display = false;
              }
           }
      	}
      }
  	}
  } 
}

function getLimits(s) {
  let limitsTab = [0,0];
  let limitType = null;
  let limitString;
  if (s.includes('goal:')) { 
    limitType = 'goal';
    limitString = s.slice(5);
  }
  else if (s.includes('limit:')) { 
    limitType = 'limit';
  	limitString = s.slice(6);
  }
  if (limitType != null) {
    let spl = limitString.split(',');
    for(let i=0;i<spl.length;i++) {
      switch(spl[i].trim().slice(0,2)) {
        case 't=':
          limitsTab[0] = spl[i].replace('t=','').trim();
          break;
        case 'd=':
          limitsTab[1] = spl[i].replace('d=','').trim();
          break;
      }
    }
    return {'type': limitType,
           	'task': limitsTab[0],
            'day': limitsTab[1]};
  }
  else { return null; }
}

function getFormat(s) {
  if (s.includes('format:')) {
    return s.slice(7).trim();
  }
  else { return '';}
}

function flagByPeriod(period, type, result, s) {
  if (period == '' || period == 'task') {
  	limitFlag['task'][type][result] = s;
  }
  if (period == '' || period == 'day') {
  	limitFlag['day'][type][result] = s;
  }
}

function getLimitFlags(parentUid) {
  let triggerTree = getChildrenTree(parentUid);
  if (triggerTree) {
    for(let i=0; i<triggerTree.length;i++) {
      let p = triggerTree[i];
      if (p.children) {
        for(let j=0; j<p.children.length;j++) {
          let c1 = p.children[j];
          if (p.string == 'goal' || p.string == 'limit') {
            if (c1.string.includes('success:') || c1.string.includes('failure:')) {
              let flagString = c1.string.slice(8).trim();
              let period = '';
              let spl = flagString.split(',');
              for(let k=0;k<spl.length;k++) {
                if (spl[k].trim().length > 1) {
                  switch(spl[k].trim().slice(0,2)) {
                    case 't=':
                      period='task';
                      flagString = spl[k].replace('t=','').trim();
                      break;
                    case 'd=':
                      period='day';
                      flagString = spl[k].replace('d=','').trim();
                      console.log(flagString);
                      break;
                  }
                }
                flagByPeriod(period,p.string,c1.string.slice(0,7),flagString);
              }
            }
          }
        }
      }
    }
  }
}

/*==============================================================================================================================*/

/* ELAPSED TIME SB */


async function elapsedTime(blockUID) {

    /************************* DEFAULT SETTINGS **************************/
        let defaultTimeLimit = 60;     // set to 0 if you want always popup notification
        let limitPresets = true;	   // false if you want disable trigger words search
        let inlineMinLimit = "goal:"; 
        let inlineMaxLimit = "max:";
        //let includeFirstChild = true;   // search for trigger words in current block AND first child block
        let pomoIsLimit = true;		  // Pomodotor timer as min trigger
        let confirmPopup = true;		  // false if you want automatic formating without popup notification
        let appendHourTag = false;      // add a tag with the round current hour, like #19:00

        let blockExcessFormat = limitFlag.task.limit.failure;
        let blockNotEnoughFormat = limitFlag.task.goal.failure; 
        let blockGoodLimitFormat = limitFlag.task.limit.success;  
        let blockGoodGoalFormat = limitFlag.task.goal.success; 
    /**********************************************************************/

        console.log(blockExcessFormat);

    let q0 = `[:find (pull ?page [:block/string])
                    :where [?page :block/uid "${blockUID}"]  ]`;
    let block = window.roamAlphaAPI.q(q0);
    let blockContent = block[0][0].string;
    let blockSplit = blockContent.split(":");
    let b = blockSplit[0].length - 2;
    if (b < 0) { b = 0;}
    let beginH = parseInt(blockContent.slice(b+0,b+2));
    let beginM = parseInt(blockContent.slice(b+3,b+5));
    let beginT = blockContent.slice(b+0,b+5);

    let currentH, currentM, currentT;
    let title="";
    let withPomo = false;

    let intIndex = blockContent.search(intervalSeparator.trim());
    let hasSndTime=false;
    if (blockSplit.length>2) {
    currentH = parseInt(blockSplit[1].slice(-2));
    currentM = parseInt(blockSplit[2].slice(0,2));
    hasSndTime = (isNaN(currentH)==false) && (isNaN(currentM)==false);  
    }
    if ((intIndex >= b+5) && (intIndex < b+7) && hasSndTime) {
    let l = intervalSeparator.length;
    currentT = addZero(currentH) + ":" + addZero(currentM);
    title = blockContent.slice(blockSplit[0].length+blockSplit[1].length+5);
    }
    else {
    let current = new Date();
    currentH = current.getHours();
    currentM = current.getMinutes();
    currentT = addZero(currentH) + ":" + addZero(currentM);
    title = blockContent.slice(b+5);
    }
    
    let elapsedH = currentH - beginH;
    if (elapsedH < 0) {elapsedH = 24 - beginH + currentH; }
    let elapsedM = currentM - beginM;
    let elapsedT = (elapsedH * 60) + elapsedM;

    let hourTag = "";
    if (appendHourTag) { hourTag = " #[[" + beginH + ":00]]"; }

    let newContent = blockSplit[0].slice(0, -2) + beginT + intervalSeparator + currentT
                    + " " + durationFormat.replace('<d>',elapsedT) + " ";
    let titleForSearch = title;

    let withMin = false;
    let withMax = false;
    let minIndex = titleForSearch.search(new RegExp(inlineMinLimit, "i"));
    let maxIndex = titleForSearch.search(new RegExp(inlineMaxLimit, "i"));
    let timeLimitMin=0, timeLimitMax=1000;

    if (minIndex != -1) {
    withMin = true;
    timeLimitMin = extractLimit(titleForSearch.slice(minIndex), inlineMinLimit.length);
    } 
    if (maxIndex != -1) {
    withMax = true;
    timeLimitMax = extractLimit(titleForSearch.slice(maxIndex), inlineMaxLimit.length);
    }

    if (pomoIsLimit) {
    let indexPomo = title.search("POMO");
    if (indexPomo != -1) {
        timeLimitMax = extractLimit(titleForSearch.slice(indexPomo), 8);
        withMax = true;
        withPomo = true;
    }
    }
    let limitType = 'Goal or limit';
    if (limitPresets && (!withMin && !withMax && !withPomo)) {
    //  let indexLimit = -1;
    let limitTab = getLimitOfFirstTriggerWord(titleForSearch.toLowerCase());
    let timeLimit = limitTab[0];
    if (timeLimit !=0) { limitType = limitTab[1]; }
    if (limitType == 'limit') {
        limitType = 'Limit';
        withMax = true;
        timeLimitMax = timeLimit;
    } else if (limitType == 'goal') {
        limitType = 'Goal';
        withMin = true;
        timeLimitMin = timeLimit;
    }
    }  

    let triggered = withMax || withMin || withPomo;
    if (withMax && withMin && (timeLimitMax <= timeLimitMin)) { withMin = false; }
    if (!triggered) {timeLimitMax = defaultTimeLimit;}
    let exceeded = ((withMax || !triggered) && (elapsedT > timeLimitMax));
    let insufficient = (withMin && (elapsedT < timeLimitMin));
    let okUnder = !exceeded && !withMin && triggered;
    let okOver = !insufficient && !withMax && triggered; 

    if (exceeded || insufficient || okUnder || okOver || triggered) { 
        let textTitle = elapsedT + "' elapsed.";
        let textMessage = limitType + " was ";
        let buttonCaption = "Too much anyway!";
        let badFormat = blockExcessFormat;
        let goodFormat = blockGoodGoalFormat;
        
        if ((!exceeded && !insufficient) || (okUnder && !insufficient) || (okOver && !exceeded)) {
        if ((!okOver && !okUnder)) { 
            textMessage += "between " + timeLimitMin + "' & " + timeLimitMax + "'";
            goodFormat = blockGoodGoalFormat;
        } else if (okUnder) {
            textMessage += "less than " + timeLimitMax + "'";
            badFormat = blockExcessFormat;
            goodFormat = blockGoodLimitFormat;
        } else {
            textMessage += "more than " + timeLimitMin + "'";
            badFormat = blockNotEnoughFormat;
            buttonCaption = "Not enough anyway!";
        }
        if (confirmPopup) {
            buttonCaption = "<button>" + buttonCaption + "</button>";
            iziToast.success({
            timeout: 6000, displayMode: 'replace', id: 'timing', zindex: 999, 
            title: textTitle,
            message: textMessage,
            position: 'bottomCenter',  drag: false, close:true,
            buttons: [
                ['<button>Great!</button>', async (instance, toast)=> {
                await window.roamAlphaAPI.updateBlock({'block': 
                    {'uid': blockUID,
                    'string': newContent + goodFormat + ' ' + title.trim() + hourTag,
                    'open': true  }});                          

                instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
                }, true],
                [buttonCaption, async (instance, toast)=> {
                await window.roamAlphaAPI.updateBlock({'block': 
                    {'uid': blockUID,
                    'string': newContent + badFormat + ' ' + title.trim() + hourTag,
                    'open': true  }});                          
                instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
                }]
            ], 
        });
        }
        }
        else {
        if ((exceeded && withMin) || (insufficient && withMax)) { 
            textMessage += "between " + timeLimitMin + "' & " + timeLimitMax + "'";
            buttonCaption = "Too much!";
            if (insufficient) { 
            badFormat = blockNotEnoughFormat;
            goodFormat = blockGoodLimitFormat;
            buttonCaption = "Not enough!";
            }
        } else if ((!okUnder && !insufficient)  || exceeded) {
            buttonCaption = "Too much!";
            goodFormat = blockGoodLimitFormat;
        if (!triggered) { 
            textMessage = "Default alert time is " + timeLimitMax + "'";}
            else {textMessage += "less than " + timeLimitMax + "'";}
        } else {
            if (!triggered) { 
            textMessage = "Default alert time is " + timeLimitMax + " '.";}
            else { textMessage += "more than " + timeLimitMin + " '."; }
            buttonCaption = "Not enough!"
            badFormat = blockNotEnoughFormat;
            goodFormat = blockGoodGoalFormat;
        }
        
        if (confirmPopup) {
        buttonCaption = "<button>" + buttonCaption + "</button>";
        iziToast.warning({
            timeout: 6000, displayMode: 'replace', id: 'timing', zindex: 999, 
            title: textTitle,
            message: textMessage,
            position: 'bottomCenter',  drag: false, close:true,
            buttons: [
                ['<button>Good anyway!</button>', async (instance, toast)=> {
                    console.log("Goooood");
                    await window.roamAlphaAPI.updateBlock({'block': 
                    {'uid': blockUID,
                    'string': newContent + goodFormat + ' ' + title.trim() + hourTag,
                    'open': true  }});   
                instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
                }],
                [buttonCaption, async (instance, toast)=> {
                    console.log("Baaaaaad");
                    await window.roamAlphaAPI.updateBlock({'block': 
                    {'uid': blockUID,
                    'string': newContent + badFormat + ' ' + title.trim() + hourTag,
                    'open': true  }});
                instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
                }, true]
            ], 
        });
        }
        else {
        newContent = newContent + badFormat;
        }
    } 
    }

window.roamAlphaAPI.updateBlock({'block': 
                          {'uid': blockUID,
                           'string': newContent + title.trim() + hourTag,
                           'open': true  }}); 
}

function getLimitOfFirstTriggerWord(s) {
  let timeLimit, limitType;
  let hasALimit = false; 
  for(let i=0; i<triggerTab.length; i++) {
    if (s.includes(triggerTab[i].word.toLowerCase())) {
      if (triggerTab[i].limit != null) {
        timeLimit = triggerTab[i].limit.task;
        limitType = triggerTab[i].limit.type;
      }
    }
    for(let j=0; j<triggerTab[i].children.length; j++) {
      let tw = triggerTab[i].children[j];
      let wordLC = tw.word.toLowerCase();
      if (s.includes(wordLC)) {
        if (tw.limit != null) {
          timeLimit = tw.limit.task;
          limitType = tw.limit.type;
          hasALimit = true;
          break;
        }
      }
    }
    if (hasALimit) { break;}
  }
  return [timeLimit,limitType];
}

function extractLimit(s, shift) {
  let t = "";
  let i = 0;
  while ((i+shift < s.length) && (!isNaN(s.charAt(i+shift)))) {
    t += s.charAt(i+shift);
  	i++;
  }
  return t;
}

function addZero(i) {
  if (i < 10) {
    i = "0" + i;
  }
  return i;
}

/*==============================================================================================================================*/

/* LOAD */

export default {
    onload:  () => {
      window.roamAlphaAPI.ui.commandPalette.addCommand({
        label: "Elapsed time",
        callback: () => {
          const startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
          elapsedTime(startUid);
        }
      })

      getParameters();
  
   /*   const args = {
        text: 'X',
        help: "Y",
        handler: (context) => () => {

          return '';
        },
      }      
      if (window.roamjs?.extension?.smartblocks) {
       // window.roamjs.extension.smartblocks.registerCommand(args);        
      } else {
        document.body.addEventListener(
          `roamjs:smartblocks:loaded`,
          () =>
            window.roamjs?.extension.smartblocks &&
            window.roamjs.extension.smartblocks.registerCommand(args)
        );
      }*/
      console.log('Elapsed Time Calculator loaded.');
    },
    onunload: () => {
      console.log('Elapsed Time Calculator unloaded.');
    }
  };

/*==============================================================================================================================*/

/*  */