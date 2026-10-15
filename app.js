'use strict';
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const campuses = [
    {id:'uw',name:'University of Warsaw',short:'UW',address:'Krakowskie Przedmieście 26/28',area:'Main campus · Śródmieście',pods:3,query:'University of Warsaw Krakowskie Przedmiescie 26 28',source:'https://en.uw.edu.pl/contacts/'},
    {id:'pw',name:'Warsaw University of Technology',short:'WUT',address:'Plac Politechniki 1',area:'Main campus · Śródmieście',pods:2,query:'Warsaw University of Technology Plac Politechniki 1',source:'https://pw.edu.pl/kontakt'},
    {id:'sgh',name:'SGH Warsaw School of Economics',short:'SGH',address:'Aleja Niepodległości 162',area:'Main campus · Mokotów',pods:4,query:'SGH Warsaw School of Economics Niepodleglosci 162',source:'https://www.sgh.waw.pl/dostepnosc-architektoniczna-sgh'}
  ];
  const storageKey = 'studybox-demo-bookings-v1';
  const timeZone = 'Europe/Warsaw';
  const rate = 12;
  let selectedCampus = 'uw';
  let availableOnly = false;
  let pricingDuration = 60;
  let reservations = [];
  let canPersist = true;
  let bookingState;
  let activeTicket;
  let toastTimer;
  const bookingDialog = $('#booking-dialog');
  const bookingsDialog = $('#bookings-dialog');
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const campusById = id => campuses.find(campus => campus.id === id);
  function nowParts() {
    const parts = new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type,part.value]));
    return {date:`${values.year}-${values.month}-${values.day}`,minutes:Number(values.hour)*60+Number(values.minute)};
  }
  function addDays(date, count) {
    const instant = new Date(`${date}T12:00:00Z`);
    instant.setUTCDate(instant.getUTCDate()+count);
    return instant.toISOString().slice(0,10);
  }
  const clock = minutes => `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
  const prettyDate = (date,long=false) => new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',weekday:long?'long':'short',day:'numeric',month:long?'long':'short'}).format(new Date(`${date}T12:00:00Z`));
  const durationText = duration => duration===30?'30 minutes':duration===60?'1 hour':'2 hours';
  const priceFor = duration => rate*duration/60;
  const podName = (campus,pod) => `${campus.short}-${String(pod).padStart(2,'0')}`;
  function validReservation(record) {
    return record && typeof record==='object' && /^SB-[A-Z0-9]{8}$/.test(record.id) && campusById(record.campus) && Number.isInteger(record.pod) && record.pod>=1 && record.pod<=campusById(record.campus).pods && /^\d{4}-\d{2}-\d{2}$/.test(record.date) && !Number.isNaN(Date.parse(record.date)) && Number.isInteger(record.start) && record.start>=480 && record.start%30===0 && [30,60,120].includes(record.duration) && record.start+record.duration<=1320 && ['confirmed','unlocked','cancelled'].includes(record.status) && typeof record.name==='string' && record.name.length<=60;
  }
  try {
    const data = JSON.parse(localStorage.getItem(storageKey)||'[]');
    if(Array.isArray(data)) reservations=data.filter(validReservation);
  } catch { canPersist=false; }
  function saveReservations() {
    try { localStorage.setItem(storageKey,JSON.stringify(reservations)); }
    catch { canPersist=false; toast('Browser storage is unavailable. Your pass will last for this visit only.'); }
    renderBookingCount();
  }
  function isActive(record) {
    const now = nowParts();
    return record.status!=='cancelled' && (record.date>now.date || (record.date===now.date && record.start+record.duration>now.minutes));
  }
  function renderBookingCount() {
    const count=reservations.filter(isActive).length;
    $$('.booking-count').forEach(element => {element.textContent=count;element.hidden=count===0;});
  }
  function hash(value) {let result=0;for(const letter of value)result=(result*31+letter.charCodeAt(0))>>>0;return result;}
  function availablePods(campusId,date,start,duration,podFilter=0) {
    const now=nowParts();
    if(!campusById(campusId)||date<now.date||date>addDays(now.date,30)||start<480||start+duration>1320||(date===now.date&&start<now.minutes+5))return [];
    const available=[];
    const campus=campusById(campusId);
    for(let pod=1;pod<=campus.pods;pod++) {
      if(podFilter && pod!==Number(podFilter))continue;
      let occupied=false;
      for(let minute=start;minute<start+duration;minute+=30){if(hash(`${campusId}-${date}-${pod}-${minute}`)%13===0){occupied=true;break;}}
      if(occupied)continue;
      occupied=reservations.some(record => record.status!=='cancelled'&&record.campus===campusId&&record.pod===pod&&record.date===date&&start<record.start+record.duration&&start+duration>record.start);
      if(!occupied)available.push(pod);
    }
    return available;
  }
  function campusAvailableToday(campus) {
    const now=nowParts();
    for(let minute=480;minute<=1290;minute+=30)if(availablePods(campus.id,now.date,minute,30).length)return true;
    return false;
  }
  function renderCampuses() {
    const term=$('#campus-search').value.trim().toLowerCase();
    const filtered=campuses.filter(campus => `${campus.name} ${campus.short} ${campus.address} ${campus.area}`.toLowerCase().includes(term)&&(!availableOnly||campusAvailableToday(campus)));
    $('#campus-count').textContent=`${filtered.length} location${filtered.length===1?'':'s'}`;
    $('#campus-list').innerHTML=filtered.length?filtered.map(campus=>`<article class="campus-card ${campus.id===selectedCampus?'selected':''}"><button class="campus-select" data-campus="${campus.id}" aria-pressed="${campus.id===selectedCampus}" aria-label="Show ${campus.name} on Google Maps"><span class="campus-badge">${campus.short}</span><span class="campus-info"><strong>${campus.name}</strong><small>${campus.address}</small></span><span class="campus-radio" aria-hidden="true"></span></button><div class="campus-card-bottom"><span class="availability"><span class="status-dot"></span>${campus.pods} demo pods</span><span class="campus-price">from <strong>12 zł / hr</strong></span></div>${campus.id===selectedCampus?`<button class="campus-book" data-book="${campus.id}">Book at this campus <span>↗</span></button>`:''}</article>`).join(''):`<div class="no-results">${icon('search')}<p>No campuses found.</p><span>Try “Warsaw” or clear your filters.</span></div>`;
  }
  function selectCampus(id) {
    const campus=campusById(id);if(!campus)return;
    selectedCampus=id;
    renderCampuses();
    const query=encodeURIComponent(campus.query);
    $('#campus-map').src=`https://maps.google.com/maps?q=${query}&z=15&hl=en&output=embed`;
    $('#campus-map').title=`Interactive Google Map of ${campus.name}`;
    $('#map-campus-name').textContent=campus.name;
    $('#map-campus-address').textContent=campus.address;
    $('#map-directions').href=`https://www.google.com/maps/dir/?api=1&destination=${query}`;
    $('#map-external').href=`https://www.google.com/maps/search/?api=1&query=${query}`;
  }
  function showDialog(dialog) {
    $$('dialog[open]').forEach(open=>open.close());
    document.body.classList.add('modal-open');
    if(!dialog.open)dialog.showModal();
  }
  $$('dialog').forEach(dialog => {
    dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('modal-open');});
    dialog.addEventListener('click',event=>{if(event.target===dialog){const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();}});
  });
  function toast(message) {clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
  function firstAvailableDate(campus,duration) {
    const today=nowParts().date;
    for(let day=0;day<3;day++){const date=addDays(today,day);for(let minute=480;minute<=1320-duration;minute+=30)if(availablePods(campus,date,minute,duration).length)return date;}
    return addDays(today,1);
  }
  function openBooking(id=selectedCampus,duration=60) {
    if(!campusById(id))id=selectedCampus;
    bookingState={campus:id,date:firstAvailableDate(id,duration),duration,start:null,pod:0,name:'',step:1};
    renderBooking();showDialog(bookingDialog);
  }
  function summaryMarkup(includeTotal=true) {
    const state=bookingState,campus=campusById(state.campus);
    const allocated=state.start===null?null:availablePods(state.campus,state.date,state.start,state.duration,state.pod)[0];
    return `<div class="booking-summary"><div class="summary-campus"><span class="campus-badge">${campus.short}</span><div><strong>${campus.name}</strong><small>${campus.address}</small></div></div><div class="summary-row"><span>Date</span><strong>${prettyDate(state.date,true)}</strong></div><div class="summary-row"><span>Your session</span><strong>${state.start===null?'Choose a time':`${clock(state.start)}–${clock(state.start+state.duration)}`} · ${durationText(state.duration)}</strong></div>${allocated?`<div class="summary-row"><span>Private pod</span><strong>${podName(campus,allocated)} · 1 person</strong></div>`:''}${includeTotal?`<div class="summary-row total"><span>Demo total · no payment</span><strong>${priceFor(state.duration)} zł</strong></div>`:''}</div>`;
  }
  function renderBooking() {
    const state=bookingState;
    const campus=campusById(state.campus);
    const today=nowParts().date;
    const stepper=`<div class="booking-stepper" aria-label="Step ${state.step} of 3"><span class="active"></span><span class="${state.step>1?'active':''}"></span><span></span></div>`;
    if(state.step===1) {
      $('#booking-content').innerHTML=`${stepper}<div class="dialog-eyebrow">01 / YOUR SPACE & TIME</div><h2 id="booking-title">Make room for focus<span>.</span></h2><p class="dialog-description">Your quiet hour starts here. Pick your perfect session.</p><label class="field-label" for="booking-campus">University</label><select class="field-select" id="booking-campus">${campuses.map(item=>`<option value="${item.id}" ${item.id===state.campus?'selected':''}>${item.name}</option>`).join('')}</select><div class="form-row"><div class="form-field"><label class="field-label" for="booking-date">Your day</label><input class="field-input" id="booking-date" type="date" required min="${today}" max="${addDays(today,30)}" value="${state.date}"><small>Book up to 30 days ahead</small></div><div class="form-field"><label class="field-label" for="booking-pod">Your pod</label><select class="field-select" id="booking-pod"><option value="0">Any available pod</option>${Array.from({length:campus.pods},(_,i)=>`<option value="${i+1}" ${state.pod===i+1?'selected':''}>${podName(campus,i+1)}</option>`).join('')}</select><small>Private space for one person</small></div></div><span class="field-label">Session length</span><div class="duration-options" role="group" aria-label="Session length">${[30,60,120].map(duration=>`<button type="button" data-duration="${duration}" aria-pressed="${state.duration===duration}" class="${state.duration===duration?'active':''}">${durationText(duration)}</button>`).join('')}</div><div class="slot-legend"><strong>Choose a start time</strong><span>Warsaw time · 08:00–22:00</span></div><div class="time-slots" role="group" aria-label="Available session start times"></div><p id="slot-message" class="storage-note" hidden></p>${summaryMarkup()}<button class="btn dialog-next" id="booking-continue" ${state.start===null?'disabled':''}>Continue to your details <span>↗</span></button><p class="demo-note">${icon('info')} An interactive demo. Availability and prices are simulated.</p>`;
      renderSlots();
    } else {
      $('#booking-content').innerHTML=`${stepper}<button class="booking-back" id="booking-back"><span>←</span> Back to your session</button><div class="dialog-eyebrow">02 / MAKE IT YOURS</div><h2 id="booking-title">Almost your quiet time<span>.</span></h2><p class="dialog-description">Check the details and get your personal demo pass.</p><form id="details-form"><label class="field-label" for="booking-name">What should we call you?</label><input class="field-input" id="booking-name" name="name" type="text" placeholder="Your first name" autocomplete="given-name" required minlength="1" maxlength="60" value="${escapeHTML(state.name)}"><div class="form-field"><small>Just a name for your pass. No account or email needed.</small></div>${summaryMarkup()}<div class="agreement"><input id="demo-agreement" type="checkbox" required><label for="demo-agreement">I understand this is a demo booking. No real pod is reserved, no payment is taken and the pass is saved only in this browser.</label></div><div id="booking-error" class="form-error" role="alert" hidden></div><button class="btn dialog-next" type="submit">Confirm demo booking <span>↗</span></button></form><p class="demo-note">${icon('lock')} Your pass stays on this device. ${canPersist?'':'Browser storage is unavailable; keep this page open.'}</p>`;
      $('#details-form').addEventListener('submit',confirmBooking);
    }
  }
  function renderSlots() {
    const state=bookingState;
    const slots=[];let count=0;
    const now=nowParts();
    const firstStart=state.date===now.date?Math.max(480,Math.ceil((now.minutes+5)/30)*30):480;
    for(let start=firstStart;start<=1320-state.duration;start+=30) {
      const pods=availablePods(state.campus,state.date,start,state.duration,state.pod);
      if(pods.length)count++;
      slots.push(`<button class="slot ${state.start===start?'active':''}" type="button" data-start="${start}" ${pods.length?'':'disabled'} aria-pressed="${state.start===start}" aria-label="${clock(start)}, ${pods.length?`${pods.length} pod${pods.length===1?'':'s'} available`:'unavailable'}">${clock(start)}</button>`);
    }
    $('.time-slots').innerHTML=slots.join('');
    $('#slot-message').hidden=count>0;
    $('#slot-message').textContent='No sessions are available for this selection. Try another date, pod or session length.';
  }
  function updateBookingSelection() {
    const state=bookingState;
    if(state.start!==null&&!availablePods(state.campus,state.date,state.start,state.duration,state.pod).length)state.start=null;
    renderBooking();
  }
  function confirmBooking(event) {
    event.preventDefault();
    const form=event.target;
    if(!form.reportValidity())return;
    const name=$('#booking-name').value.trim();
    if(!name){$('#booking-name').setCustomValidity('Please enter a name for your pass.');$('#booking-name').reportValidity();return;}
    bookingState.name=name;
    const state=bookingState;
    const pod=availablePods(state.campus,state.date,state.start,state.duration,state.pod)[0];
    if(!pod){state.step=1;state.start=null;renderBooking();toast('That session is no longer available. Please choose another time.');return;}
    let id;
    do {const bytes=new Uint8Array(5);crypto.getRandomValues(bytes);id=`SB-${Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('').slice(0,8).toUpperCase()}`;}while(reservations.some(record=>record.id===id));
    const record={id,campus:state.campus,date:state.date,start:state.start,duration:state.duration,pod,name,status:'confirmed',createdAt:new Date().toISOString()};
    reservations.push(record);saveReservations();renderCampuses();renderTicket(record);toast('Your demo session is reserved. Your QR pass is ready.');
  }
  function renderTicket(record) {
    activeTicket=record.id;
    const campus=campusById(record.campus);
    const unlocked=record.status==='unlocked';
    const expired=!isActive(record);
    const status=expired?'Session ended':unlocked?'Demo pod unlocked':'Demo reservation confirmed';
    $('#booking-content').innerHTML=`<div class="booking-stepper" aria-label="Step 3 of 3"><span class="active"></span><span class="active"></span><span class="active"></span></div><div class="ticket-header"><span class="success-symbol">${icon('check')}</span><div class="dialog-eyebrow">03 / YOUR HEADSPACE AWAITS</div><h2 id="booking-title">${unlocked?'Hello, headspace.':`You’re in, ${escapeHTML(record.name)}.`}</h2><p>${unlocked?'Your simulated door is open. Time to make something great.':'Your demo pass is ready. One less thing between you and your next big idea.'}</p></div><div class="ticket"><div class="ticket-top"><div class="eyebrow">STUDYBOX / PERSONAL DEMO PASS</div><strong>${campus.name}</strong><span>${campus.address}</span><div class="ticket-meta"><div><small>YOUR DAY</small><strong>${prettyDate(record.date)}</strong></div><div><small>YOUR TIME · WARSAW</small><strong>${clock(record.start)}–${clock(record.start+record.duration)}</strong></div><div><small>YOUR PRIVATE POD</small><strong>${podName(campus,record.pod)} · 1 person</strong></div><div><small>DEMO TOTAL</small><strong>${priceFor(record.duration)} zł · No payment</strong></div></div></div><div class="ticket-qr"><span class="ticket-status ${unlocked?'':'pending'}"><span class="status-dot"></span> ${status}</span><div id="qr-code" aria-label="Scannable QR code containing demo booking identifier ${record.id}"></div><p class="ticket-id">${record.id} · DEMO ACCESS ONLY</p></div></div>${unlocked?'<div class="unlock-result">✓ &nbsp; Door open — in the demo.<br><small>Your focus session is ready. No physical lock was activated.</small></div>':''}<div class="ticket-actions"><button class="btn" id="simulate-unlock" ${unlocked||expired?'disabled':''}>${icon('qr')} ${unlocked?'Demo pod unlocked':expired?'Session ended':'Simulate QR scan'} <span>↗</span></button><button class="btn btn-white" id="download-calendar" aria-label="Add this demo session to your calendar" title="Add to calendar">${icon('calendar')}</button></div><button class="text-button" style="margin-top:18px;padding:0;font-size:10px" data-open-bookings>View my bookings <span>↗</span></button><p class="demo-note">${icon('info')} QR contains a demo ID. No real pod or access system is connected.</p>`;
    try {
      if(typeof QRCode!=='function')throw new Error('QR unavailable');
      new QRCode($('#qr-code'),{text:`STUDYBOX-DEMO:${record.id}`,width:155,height:155,colorDark:'#101e37',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
      const qrImage=$('#qr-code img');if(qrImage)qrImage.alt=`StudyBox demo QR pass ${record.id}`;
    } catch {$('#qr-code').innerHTML='<p class="qr-error">QR display is unavailable. Your booking ID above is saved.</p>';}
    showDialog(bookingDialog);
    bookingDialog.scrollTop=0;
  }
  function renderSavedBookings() {
    const records=[...reservations].reverse();
    $('#saved-bookings').innerHTML=records.length?records.map(record=>{
      const campus=campusById(record.campus),cancelled=record.status==='cancelled',active=isActive(record);
      return `<article class="saved-card"><div class="saved-card-top"><div><strong>${campus.name}</strong><small>${prettyDate(record.date)} · ${clock(record.start)}–${clock(record.start+record.duration)} · ${podName(campus,record.pod)}</small></div><span class="saved-status ${cancelled||!active?'cancelled':''}">${cancelled?'Cancelled':!active?'Completed':record.status==='unlocked'?'Demo unlocked':'Confirmed'}</span></div><div class="saved-card-bottom"><strong>${priceFor(record.duration)} zł <small style="font-weight:400;color:#9ba6b8;font-size:8px">demo total</small></strong><div>${!cancelled&&active?`<button class="saved-cancel" data-cancel="${record.id}">Cancel session</button>`:''}${!cancelled?`<button class="saved-view" data-pass="${record.id}">View QR pass ↗</button>`:''}</div></div><div id="cancel-${record.id}"></div></article>`;
    }).join(''):`<div class="empty-bookings">${icon('calendar')}<h3>Your next focused hour is waiting.</h3><p>No sessions yet. Choose a campus and make a little time for yourself.</p><button class="btn" data-book>Find my StudyBox <span>↗</span></button></div>`;
  }
  function openSavedBookings(){renderSavedBookings();showDialog(bookingsDialog);}
  function calendarTimestamp(date,minutes) {
    const [year,month,day]=date.split('-').map(Number);
    const target=Date.UTC(year,month-1,day,Math.floor(minutes/60),minutes%60);
    let result=target;
    for(let i=0;i<3;i++) {
      const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(result)).map(part=>[part.type,part.value]));
      const viewed=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
      result+=target-viewed;
    }
    return new Date(result).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  }
  function downloadCalendar(record) {
    const campus=campusById(record.campus);
    const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//StudyBox//Booking Demo//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${record.id}@studybox.demo`,`DTSTAMP:${stamp}`,`DTSTART:${calendarTimestamp(record.date,record.start)}`,`DTEND:${calendarTimestamp(record.date,record.start+record.duration)}`,`SUMMARY:StudyBox DEMO - ${campus.short}`,`LOCATION:${campus.address.replace(/,/g,'\\,')} - Warsaw`,`DESCRIPTION:Demo session only. No real pod reserved. Pass ${record.id}.`,'STATUS:TENTATIVE','END:VEVENT','END:VCALENDAR'].join('\r\n');
    const url=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download=`studybox-${record.id}.ics`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Demo calendar event downloaded.');
  }
  document.addEventListener('click',event=>{
    const target=event.target.closest('button,a');if(!target)return;
    if(target.hasAttribute('data-book')){openBooking(target.dataset.book||selectedCampus);return;}
    if(target.hasAttribute('data-open-bookings')){openSavedBookings();return;}
    if(target.hasAttribute('data-close-dialog')){target.closest('dialog').close();return;}
    if(target.dataset.campus){selectCampus(target.dataset.campus);return;}
    if(target.dataset.duration){bookingState.duration=Number(target.dataset.duration);updateBookingSelection();return;}
    if(target.dataset.start){bookingState.start=Number(target.dataset.start);renderBooking();return;}
    if(target.id==='booking-continue'){
      if(!$('#booking-date').reportValidity()||bookingState.start===null)return;
      if(!availablePods(bookingState.campus,bookingState.date,bookingState.start,bookingState.duration,bookingState.pod).length){bookingState.start=null;renderBooking();toast('Please choose an available time.');return;}
      bookingState.step=2;renderBooking();bookingDialog.scrollTop=0;$('#booking-name').focus({preventScroll:true});return;
    }
    if(target.id==='booking-back'){bookingState.name=$('#booking-name').value;bookingState.step=1;renderBooking();bookingDialog.scrollTop=0;return;}
    if(target.dataset.pass){const record=reservations.find(item=>item.id===target.dataset.pass&&item.status!=='cancelled');if(record)renderTicket(record);return;}
    if(target.dataset.cancel){const id=target.dataset.cancel;const holder=document.getElementById(`cancel-${id}`);holder.innerHTML=`<div class="cancel-confirm">Cancel this demo session? Your time slot will be released.<div><button data-confirm-cancel="${id}">Yes, cancel session</button><button data-keep-booking="${id}">Keep my session</button></div></div>`;return;}
    if(target.dataset.confirmCancel){const record=reservations.find(item=>item.id===target.dataset.confirmCancel);if(record){record.status='cancelled';saveReservations();renderSavedBookings();renderCampuses();toast('Demo session cancelled. Your time slot has been released.');}return;}
    if(target.dataset.keepBooking){document.getElementById(`cancel-${target.dataset.keepBooking}`).innerHTML='';return;}
    if(target.id==='simulate-unlock'){
      const record=reservations.find(item=>item.id===activeTicket);
      if(!record||record.status==='cancelled'||!isActive(record)){toast('This demo pass is no longer active.');return;}
      target.disabled=true;target.textContent='Scanning your demo pass…';
      setTimeout(()=>{if(record.status!=='cancelled'&&isActive(record)){record.status='unlocked';saveReservations();if(bookingDialog.open&&activeTicket===record.id)renderTicket(record);toast('Demo scan successful. Welcome to your quiet space.');}},850);return;
    }
    if(target.id==='download-calendar'){const record=reservations.find(item=>item.id===activeTicket);if(record)downloadCalendar(record);return;}
    if(target.dataset.priceDuration){pricingDuration=Number(target.dataset.priceDuration);$$('[data-price-duration]').forEach(button=>{const active=Number(button.dataset.priceDuration)===pricingDuration;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active);});$('#price-total').textContent=`${priceFor(pricingDuration)} zł for ${durationText(pricingDuration)}`;return;}
    if(target.id==='price-book'){openBooking(selectedCampus,pricingDuration);return;}
    if(target.hasAttribute('data-open-privacy')){showDialog($('#privacy-dialog'));return;}
    if(target.id==='clear-data'){
      if(target.dataset.confirm!=='true'){target.dataset.confirm='true';target.textContent='Confirm: delete all my demo bookings';return;}
      reservations=[];try{localStorage.removeItem(storageKey);}catch{}
      renderBookingCount();renderCampuses();target.dataset.confirm='false';target.innerHTML='Clear my demo bookings <span>↗</span>';toast('All demo bookings have been removed from this browser.');return;
    }
  });
  bookingDialog.addEventListener('change',event=>{
    const target=event.target;
    if(target.id==='booking-campus'){bookingState.campus=target.value;bookingState.pod=0;updateBookingSelection();}
    if(target.id==='booking-pod'){bookingState.pod=Number(target.value);updateBookingSelection();}
    if(target.id==='booking-date'){
      const today=nowParts().date;
      if(!target.value||!target.validity.valid||target.value<today||target.value>addDays(today,30)){target.setCustomValidity('Choose a date within the next 30 days.');target.reportValidity();return;}
      target.setCustomValidity('');bookingState.date=target.value;updateBookingSelection();
    }
  });
  bookingDialog.addEventListener('input',event=>{if(event.target.id==='booking-name'||event.target.id==='booking-date')event.target.setCustomValidity('');});
  $('#campus-search').addEventListener('input',renderCampuses);
  $('#available-filter').addEventListener('click',event=>{availableOnly=!availableOnly;event.currentTarget.setAttribute('aria-pressed',availableOnly);renderCampuses();});
  const menuButton=$('.menu-button'),mobileNav=$('.mobile-nav');
  menuButton.addEventListener('click',()=>{const open=menuButton.getAttribute('aria-expanded')!=='true';menuButton.setAttribute('aria-expanded',open);menuButton.setAttribute('aria-label',open?'Close menu':'Open menu');mobileNav.hidden=!open;});
  mobileNav.addEventListener('click',event=>{if(event.target.closest('a,button')){mobileNav.hidden=true;menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Open menu');}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){mobileNav.hidden=true;menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Open menu');}});
  window.addEventListener('storage',event=>{if(event.key===storageKey){try{const data=JSON.parse(event.newValue||'[]');reservations=Array.isArray(data)?data.filter(validReservation):[];renderBookingCount();renderCampuses();if(bookingsDialog.open)renderSavedBookings();if(bookingDialog.open&&bookingState?.step===1&&$('#booking-date'))updateBookingSelection();}catch{}}});
  function updateScroll(){const height=document.documentElement.scrollHeight-innerHeight;$('.scroll-progress').style.transform=`scaleX(${height>0?Math.min(scrollY/height,1):0})`;$('#header').classList.toggle('scrolled',scrollY>20);}
  let scrollFrame=false;
  window.addEventListener('scroll',()=>{if(!scrollFrame){requestAnimationFrame(()=>{updateScroll();scrollFrame=false;});scrollFrame=true;}},{passive:true});
  window.addEventListener('resize',updateScroll);
  $('#year').textContent=new Date().getFullYear();
  renderCampuses();renderBookingCount();updateScroll();
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
  if(window.gsap&&window.ScrollTrigger&&!reduceMotion.matches){
    gsap.registerPlugin(ScrollTrigger);
    const timeline=gsap.timeline({defaults:{ease:'power3.out'}});
    timeline.from('.hero-intro',{y:10,opacity:0,duration:.65},.05).from('.hero h1>span',{y:32,opacity:0,duration:.85,stagger:.12},.12).from('.hero-description,.hero-actions,.hero-note,.hero-benefits',{y:20,opacity:0,duration:.65,stagger:.1},.35).from('.pod-image',{y:25,opacity:0,scale:.97,duration:1.2},.2).from('.floating-status',{y:20,opacity:0,duration:.8},.85);
    gsap.utils.toArray('.reveal').forEach(element=>{gsap.from(element,{opacity:0,y:30,duration:.8,ease:'power2.out',scrollTrigger:{trigger:element,start:'top 93%',once:true}});});
    gsap.to('.hero-visual .pod-image',{y:35,ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:1}});
    gsap.to('.closing-orbit',{rotation:8,y:-35,ease:'none',scrollTrigger:{trigger:'.closing',start:'top bottom',end:'bottom top',scrub:1}});
    $$('[data-count]').forEach(element=>{const count={value:0};gsap.to(count,{value:Number(element.dataset.count),duration:1.6,ease:'power2.out',onUpdate:()=>{element.textContent=Math.round(count.value);},scrollTrigger:{trigger:element,start:'top 95%',once:true}});});
    window.addEventListener('load',()=>ScrollTrigger.refresh(),{once:true});
    document.fonts.ready.then(()=>ScrollTrigger.refresh());
  }
})();
