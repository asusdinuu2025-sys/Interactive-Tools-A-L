/* StudyLab interior neon doodles.
   Original, decorative-only vector strokes. One reusable backdrop per hub.
   Page identity comes from an allowlisted body data attribute, never user data.
   No changes to timers, navigation, resources, or stored settings. */
(() => {
  "use strict";
  const page = document.body?.dataset.slNeonPage;
  if (!page || page === "telegram" || document.querySelector(".sl-neon-layer")) return;

  const drawings = Object.freeze({
    sigma: '<text x="50" y="73" text-anchor="middle" font-family="Georgia,serif" font-size="68" fill="currentColor" stroke="none">∑</text>',
    pi: '<text x="50" y="70" text-anchor="middle" font-family="Georgia,serif" font-size="69" fill="currentColor" stroke="none">π</text>',
    integral: '<text x="50" y="74" text-anchor="middle" font-family="Georgia,serif" font-size="78" fill="currentColor" stroke="none">∫</text>',
    sine: '<path d="M7 50H93 M50 10V89" opacity=".37"/><path d="M7 50C24 5 37 5 50 50S76 95 93 50" stroke-width="2.2"/><path d="M9 44V56 M87 44V56" opacity=".38"/>',
    parabola: '<path d="M16 13V87H91" opacity=".48"/><path d="M21 23Q51 120 83 23" stroke-width="2.35"/><circle cx="52" cy="70" r="2.8" fill="currentColor" stroke="none"/>',
    triangle: '<path d="M13 81 50 14 88 81Z M50 14V81 M31 65H69"/><path d="M17 75Q25 66 31 68" opacity=".65"/>',
    compass: '<path d="M33 80 51 16 70 80 M37 68H66 M34 83l-4 9 M69 83l5 9"/><circle cx="51" cy="18" r="5"/><path d="M15 72Q50 90 89 71" stroke-dasharray="4 7"/>',
    graph: '<path d="M14 14V86H88 M23 71 40 54 52 66 73 29 87 38"/><circle cx="23" cy="71" r="3"/><circle cx="40" cy="54" r="3"/><circle cx="52" cy="66" r="3"/><circle cx="73" cy="29" r="3"/>',
    atom: '<ellipse cx="50" cy="50" rx="38" ry="13"/><ellipse cx="50" cy="50" rx="38" ry="13" transform="rotate(60 50 50)"/><ellipse cx="50" cy="50" rx="38" ry="13" transform="rotate(120 50 50)"/><circle cx="50" cy="50" r="5" fill="currentColor" stroke="none"/>',
    circuit: '<path d="M16 28H40 M60 28H84V70H58 M42 70H16V28"/><path d="M40 19V37 M60 19V37 M42 28H60"/><path d="M42 70H58 M44 60 56 80 M56 60 44 80"/><circle cx="15" cy="28" r="3"/>',
    pendulum: '<path d="M15 17H85 M50 17V22 M50 22 76 70"/><circle cx="76" cy="73" r="11"/><path d="M22 76Q50 98 80 79" stroke-dasharray="4 8"/><path d="M39 40Q50 36 58 48" opacity=".5"/>',
    prism: '<path d="M30 77 50 24 73 77Z M3 36 39 53 M59 53 96 25 M59 56 96 44 M59 59 96 62"/><path d="M5 39 40 56" opacity=".4"/>',
    magnet: '<path d="M20 14V58C20 96 80 96 80 58V14H60V58C60 70 40 70 40 58V14Z M20 33H40 M60 33H80"/>',
    wave: '<path d="M4 50C19 8 30 8 44 50S70 92 96 50" stroke-width="2.6"/><path d="M5 50H96" stroke-dasharray="3 8" opacity=".45"/>',
    bolt: '<path d="M56 7 22 53H45L39 94 81 41H55Z" stroke-width="2.5"/>',
    formula: '<text x="50" y="60" text-anchor="middle" font-family="Georgia,serif" font-size="24" fill="currentColor" stroke="none">E=mc²</text><path d="M16 71H84" opacity=".45"/>',
    flask: '<path d="M35 12H65 M41 12V41L17 83Q11 92 23 92H77Q89 92 83 83L59 41V12 M29 66Q50 60 71 66 M34 74H66"/><circle cx="43" cy="78" r="3"/><circle cx="58" cy="82" r="2"/>',
    molecule: '<path d="M23 52 47 27 75 46 66 79 33 82 23 52 M47 27 37 10 M75 46 88 32"/><circle cx="23" cy="52" r="7"/><circle cx="47" cy="27" r="7"/><circle cx="75" cy="46" r="7"/><circle cx="66" cy="79" r="7"/><circle cx="33" cy="82" r="7"/>',
    testtube: '<path d="M34 11H66 M40 11V70Q40 88 53 88T66 70V11 M40 50Q51 55 66 49 M45 63h8"/><circle cx="55" cy="71" r="3"/>',
    hexagon: '<path d="M50 8 82 26V65L50 85 18 65V26Z M50 14 76 30 M76 61 50 78 M24 61V30 M82 26 95 19"/><circle cx="50" cy="8" r="3"/>',
    beaker: '<path d="M19 17H81 M27 17V85H73V17 M28 57Q50 64 72 57 M38 31H50 M38 41H46"/><circle cx="61" cy="72" r="3"/>',
    bubbles: '<circle cx="34" cy="67" r="18"/><circle cx="72" cy="33" r="12"/><circle cx="70" cy="79" r="6"/><circle cx="29" cy="23" r="7"/><path d="M25 60Q28 52 35 51 M69 28l5-4"/>',
    reaction: '<path d="M13 29H39 M32 22l8 7-8 7 M59 29H87 M80 22l8 7-8 7 M20 67H80 M72 60l8 7-8 7"/><text x="49" y="57" text-anchor="middle" font-size="16" fill="currentColor" stroke="none">A+B</text>',
    dna: '<path d="M25 8C86 34 14 65 76 92 M76 8C14 34 86 65 25 92"/><path d="M38 17H63 M43 28H57 M35 40H65 M42 51H58 M35 63H65 M42 75H58 M38 86H63"/>',
    leaf: '<path d="M14 83C18 17 74 9 87 10 89 41 82 83 14 83Z M16 84Q48 51 81 23 M46 58 43 37 M61 41 82 44 M31 72 27 54"/>',
    cell: '<ellipse cx="50" cy="50" rx="42" ry="33" transform="rotate(-13 50 50)"/><circle cx="47" cy="49" r="16"/><circle cx="51" cy="47" r="7"/><path d="M18 39q10-15 19-11 M62 69q14 7 22-6 M24 62l10 8"/>',
    microscope: '<path d="M35 10 62 10 74 23 56 42 36 24Z M59 41Q79 50 70 70T40 80 M27 78H83 M27 88H83 M35 24l-10 16 M25 40l-8-6 M17 34l-7 11 M61 20l8 8"/><circle cx="70" cy="70" r="5"/>',
    neuron: '<circle cx="50" cy="51" r="17"/><path d="M33 51 13 31 5 29 M37 40 23 16 M50 34V11 M64 43 83 20 M68 53 91 50 M60 66 69 86 88 94 M43 67 27 89 15 91 M51 49l5 5"/><circle cx="50" cy="51" r="5"/>',
    chromosome: '<path d="M27 13C35 36 66 65 73 88 M73 13C65 36 34 65 27 88 M28 16 72 86 M72 16 28 86" stroke-width="2.6"/>',
    sprout: '<path d="M50 91V39 M50 61Q21 66 16 36 41 30 50 54 M50 42Q56 12 85 13 83 44 51 48 M33 91H68"/><path d="M50 52l-12-13 M54 38l19-17"/>',
    paper: '<path d="M25 8H63L79 24V91H25Z M62 8V25H79 M35 39H67 M35 51H67 M35 63H62 M35 75H57"/>',
    pencil: '<path d="M19 76 68 21 82 34 33 88 14 91Z M62 28 76 42 M19 76 33 88 M68 21 76 14 89 27 82 34"/>',
    clock: '<circle cx="50" cy="50" r="39"/><path d="M50 22V51L68 63 M50 13V17 M50 83V87 M13 50H17 M83 50H87"/>',
    calendar: '<rect x="15" y="22" width="70" height="63" rx="8"/><path d="M15 41H85 M34 12V29 M66 12V29 M28 55H39 M49 55H60 M28 67H39 M49 67H60"/>',
    check: '<circle cx="50" cy="50" r="37"/><path d="M30 50 45 65 73 36" stroke-width="3"/>',
    certificate: '<rect x="15" y="14" width="70" height="60" rx="6"/><path d="M28 29H70 M28 40H62 M28 51H50"/><circle cx="71" cy="66" r="13"/><path d="M64 79 61 96 71 89 82 96 79 79"/>',
    bookmark: '<path d="M28 13H72V88L50 73 28 88Z M37 31H63"/>',
    target: '<circle cx="50" cy="50" r="37"/><circle cx="50" cy="50" r="24"/><circle cx="50" cy="50" r="10"/><path d="M75 26 54 46 M75 26 85 22 M75 26 79 16"/>',
    stopwatch: '<circle cx="50" cy="56" r="32"/><path d="M50 25V13 M35 13H65 M50 56 68 43 M75 31 84 23 M79 18 88 27"/>',
    hourglass: '<path d="M24 12H76 M24 88H76 M31 13C31 36 69 39 69 50S31 64 31 87 M69 13C69 36 31 39 31 50S69 64 69 87"/><path d="M37 77Q50 70 63 77 M43 33 50 39 57 33"/>',
    calculator: '<rect x="24" y="11" width="52" height="78" rx="7"/><rect x="32" y="22" width="36" height="15" rx="3"/><path d="M34 49H41 M52 49H59 M34 62H41 M52 62H59 M34 75H41 M52 75H59"/>',
    checklist: '<rect x="21" y="13" width="58" height="76" rx="8"/><path d="M33 35 38 40 47 29 M54 36H69 M33 60 38 65 47 54 M54 60H69 M33 78H45 M54 78H69"/>',
    book: '<path d="M50 21C35 11 23 12 12 18V82C25 76 39 79 50 87 61 79 75 76 88 82V18C77 12 65 11 50 21Z M50 21V87 M22 31Q34 27 42 33 M58 33Q69 27 80 31"/>',
    notebook: '<rect x="24" y="12" width="55" height="77" rx="6"/><path d="M24 12V89 M35 12V89 M43 34H67 M43 46H70 M43 58H64 M43 70H67"/><path d="M18 25H29 M18 41H29 M18 57H29 M18 73H29"/>',
    cap: '<path d="M8 39 50 17 92 39 50 62Z M25 50V71Q50 87 75 71V50 M91 40V71 M86 72H96"/>',
    stack: '<path d="M19 25 50 10 81 25 50 41Z M19 43 50 58 81 43 M19 59 50 74 81 59 M19 74 50 89 81 74"/>',
    headphones: '<path d="M18 53V47C18 9 82 9 82 47V53 M18 53H28V79H18Q10 76 10 67V61Q10 55 18 53 M82 53H72V79H82Q90 76 90 67V61Q90 55 82 53"/><path d="M72 79Q67 91 50 91"/>',
    waveform: '<path d="M8 51H18 M23 34V67 M32 18V83 M42 39V61 M52 8V91 M62 27V74 M72 40V60 M82 24V78 M91 51H97" stroke-width="2.4"/>',
    play: '<circle cx="50" cy="50" r="38"/><path d="M39 29 71 50 39 72Z" stroke-width="2.6"/>',
    music: '<path d="M43 66V22L77 14V61 M43 27 77 19"/><ellipse cx="31" cy="72" rx="12" ry="8"/><ellipse cx="65" cy="67" rx="12" ry="8"/>',
    speaker: '<path d="M19 41H37L57 24V76L37 60H19Z M66 41Q78 50 66 60 M72 30Q91 50 72 70"/>',
    quote: '<path d="M20 22H44V48Q44 72 18 78 M54 22H78V48Q78 72 53 78"/><path d="M19 58H29 M54 58H64"/>',
    pen: '<path d="M24 83 58 14 79 31 41 90 24 83Z M58 14 65 8 86 25 79 31 M30 81 39 87 M25 93H80"/>',
    speech: '<path d="M12 22H88V68H47L29 86V68H12Z M26 36H74 M26 47H62 M26 58H50"/>',
    abc: '<text x="50" y="59" text-anchor="middle" font-family="Georgia,serif" font-size="39" fill="currentColor" stroke="none">ABC</text><path d="M16 70H85" opacity=".52"/>',
    globe: '<circle cx="50" cy="50" r="38"/><ellipse cx="50" cy="50" rx="19" ry="38"/><path d="M12 50H88 M20 29Q50 43 80 29 M20 71Q50 57 80 71"/>',
    puzzle: '<path d="M17 16H39Q37 32 50 32T61 16H83V40Q66 39 66 52T83 63V83H62Q63 66 50 66T38 83H17V62Q34 63 34 50T17 39Z"/>',
    bulb: '<path d="M31 61C16 39 31 15 50 15S84 39 69 61L62 71H38Z M39 78H61 M42 87H58 M50 27V39 M41 47H59"/>',
    question: '<circle cx="50" cy="50" r="38"/><path d="M35 35Q35 19 51 19T66 35Q66 45 50 51V60"/><circle cx="50" cy="74" r="3" fill="currentColor" stroke="none"/>',
    monitor: '<rect x="10" y="16" width="80" height="58" rx="7"/><path d="M50 74V88 M31 88H69 M18 59H82 M32 37 24 45 32 53 M68 37 76 45 68 53"/>',
    code: '<path d="M34 23 12 50 34 77 M66 23 88 50 66 77 M58 14 41 86" stroke-width="2.3"/>',
    chip: '<rect x="25" y="25" width="50" height="50" rx="6"/><rect x="36" y="36" width="28" height="28" rx="4"/><path d="M36 10V25 M50 10V25 M64 10V25 M36 75V90 M50 75V90 M64 75V90 M10 36H25 M10 50H25 M10 64H25 M75 36H90 M75 50H90 M75 64H90"/>',
    wifi: '<path d="M10 40Q50 5 90 40 M22 54Q50 28 78 54 M36 68Q50 56 64 68"/><circle cx="50" cy="82" r="5" fill="currentColor" stroke="none"/>',
    binary: '<text x="50" y="39" text-anchor="middle" font-family="Consolas,monospace" font-size="25" fill="currentColor" stroke="none">1010</text><text x="50" y="69" text-anchor="middle" font-family="Consolas,monospace" font-size="25" fill="currentColor" stroke="none">0110</text>',
    terminal: '<rect x="13" y="17" width="74" height="66" rx="7"/><path d="M13 32H87 M27 47 39 56 27 65 M48 68H72"/><circle cx="24" cy="25" r="2"/><circle cx="34" cy="25" r="2"/>',
    keyboard: '<rect x="9" y="25" width="82" height="51" rx="5"/><path d="M21 38H29 M37 38H45 M53 38H61 M69 38H77 M21 48H29 M37 48H45 M53 48H61 M69 48H77 M21 58H29 M37 58H45 M53 58H61 M69 58H77 M30 68H70"/>'
  });

  const pageIcons = Object.freeze({
    maths:       ["sigma","pi","sine","parabola","triangle","integral","compass","graph"],
    physics:     ["atom","circuit","pendulum","prism","magnet","wave","bolt","formula"],
    chemistry:   ["flask","molecule","testtube","hexagon","beaker","bubbles","reaction","atom"],
    biology:     ["dna","leaf","cell","microscope","neuron","chromosome","sprout","molecule"],
    exam:        ["paper","pencil","clock","calendar","check","certificate","bookmark","target"],
    utilities:   ["stopwatch","calculator","checklist","hourglass","target","graph","calendar","bulb"],
    lessons:     ["book","notebook","bookmark","cap","pencil","paper","check","stack"],
    revise:      ["bolt","formula","circuit","wave","atom","book","pendulum","sigma"],
    audio:       ["headphones","waveform","music","play","flask","speaker","testtube","wave"],
    english:     ["abc","quote","pen","speech","book","paper","bookmark","pencil"],
    gct:         ["globe","puzzle","bulb","question","compass","book","check","target"],
    git:         ["monitor","code","chip","wifi","binary","terminal","keyboard","graph"],
    "study-room":["stopwatch","book","target","hourglass","pendulum","checklist","wave","clock"]
  });
  const names = pageIcons[page];
  if (!names) return;
  const NS = "http://www.w3.org/2000/svg";
  const layer = document.createElement("div");
  layer.className = "sl-neon-layer";
  layer.setAttribute("aria-hidden","true");
  for (const [i,name] of names.entries()) {
    const shape = drawings[name];
    if (!shape) continue;
    const wrapper = document.createElement("span");
    wrapper.className = "sl-neon-glyph";
    wrapper.dataset.icon = name;
    const svg = document.createElementNS(NS,"svg");
    svg.setAttribute("viewBox","0 0 100 100");
    svg.setAttribute("focusable","false");
    svg.setAttribute("aria-hidden","true");
    svg.setAttribute("fill","none");
    svg.setAttribute("stroke","currentColor");
    svg.setAttribute("stroke-width","1.85");
    svg.setAttribute("stroke-linecap","round");
    svg.setAttribute("stroke-linejoin","round");
    // All SVG fragments are immutable literals from the allowlisted icon map.
    svg.innerHTML = shape;
    wrapper.append(svg);
    layer.append(wrapper);
  }
  document.body.prepend(layer);
})();
