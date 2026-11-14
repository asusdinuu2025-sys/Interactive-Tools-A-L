/* StudyLab AI response formatting: sanitized Markdown and lazy KaTeX. */
(() => {
  "use strict";
  const START = "\uE200SLM", END = "\uE201";
  let katexPromise = null;

  function protectMath(input) {
    const math = [];
    const replaceMath = (value, re, display) => value.replace(re, (full, latex) => {
      if (!latex || latex.length > 2400) return full;
      const index = math.push({latex, display}) - 1;
      return START + index + END;
    });
    // Leave fenced and inline code alone; only prose gets math placeholders.
    const parts = input.split(/(\x60{3}[\s\S]*?\x60{3}|\x60[^\x60\n]+\x60)/g);
    const markdown = parts.map(part => {
      if (part.charCodeAt(0) === 96) return part;
      let value = replaceMath(part, /\$\$([\s\S]+?)\$\$/g, true);
      value = replaceMath(value, /\\\[([\s\S]+?)\\\]/g, true);
      value = replaceMath(value, /\\\(([\s\S]+?)\\\)/g, false);
      value = replaceMath(value, /(?<!\\)\$([^\n$]+?)\$/g, false);
      return value;
    }).join("");
    return {markdown, math};
  }

  function loadKatex() {
    if (window.katex?.render) return Promise.resolve(window.katex);
    if (katexPromise) return katexPromise;
    if (!document.getElementById("studylab-ai-katex-css")) {
      const link = document.createElement("link");
      link.id = "studylab-ai-katex-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/katex@0.19.1/dist/katex.min.css";
      document.head.append(link);
    }
    katexPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/katex@0.19.1/dist/katex.min.js";
      script.async = true;
      script.onload = () => window.katex?.render
        ? resolve(window.katex) : reject(new Error("KaTeX unavailable"));
      script.onerror = () => reject(new Error("KaTeX could not load"));
      document.head.append(script);
    });
    return katexPromise;
  }

  function mountMath(container, math) {
    const token = /\uE200SLM(\d+)\uE201/g;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest("code,pre")) continue;
      if (node.nodeValue.includes(START)) nodes.push(node);
    }
    const equations = [];
    for (const node of nodes) {
      const fragment = document.createDocumentFragment();
      let from = 0;
      token.lastIndex = 0;
      for (const match of node.nodeValue.matchAll(token)) {
        if (match.index > from) fragment.append(document.createTextNode(node.nodeValue.slice(from, match.index)));
        const item = math[Number(match[1])];
        if (item) {
          const element = document.createElement("span");
          element.className = "studylab-ai-math" + (item.display ? " is-display" : "");
          element.textContent = item.display ? "\\[" + item.latex + "\\]" : "\\(" + item.latex + "\\)";
          fragment.append(element);
          equations.push({element, latex:item.latex, display:item.display});
        } else fragment.append(document.createTextNode(match[0]));
        from = match.index + match[0].length;
      }
      if (from < node.nodeValue.length) fragment.append(document.createTextNode(node.nodeValue.slice(from)));
      node.replaceWith(fragment);
    }
    if (!equations.length) return;
    loadKatex().then(katex => {
      for (const item of equations) {
        if (!item.element.isConnected) continue;
        try {
          katex.render(item.latex, item.element, {
            throwOnError:false, displayMode:item.display, trust:false, strict:"ignore"
          });
        } catch (_) { /* Readable LaTeX is already present. */ }
      }
    }).catch(() => { /* Keep text fallback if the math CDN is unreachable. */ });
  }

  function render(element, raw) {
    if (!element) return;
    const text = String(raw || "");
    const marked = window.marked?.marked || window.marked;
    const purifier = window.DOMPurify;
    if (typeof marked?.parse !== "function" || !purifier?.sanitize) {
      element.textContent = text;
      return;
    }
    try {
      const prepared = protectMath(text);
      const html = marked.parse(prepared.markdown, {gfm:true, breaks:true});
      if (typeof html !== "string") throw new Error("Markdown parser returned no HTML");
      const safe = purifier.sanitize(html, {
        ALLOWED_TAGS: [
          "p","br","b","strong","i","em","u","s","del","a","code","pre",
          "blockquote","ul","ol","li","hr","h2","h3","h4","h5","h6",
          "sub","sup","span","div","table","thead","tbody","tr","th","td"
        ],
        ALLOWED_ATTR: ["href","title"],
        ALLOW_DATA_ATTR:false, ALLOW_ARIA_ATTR:false
      });
      const template = document.createElement("template");
      template.innerHTML = safe; // Only HTML already sanitized by DOMPurify.
      template.content.querySelectorAll("a[href]").forEach(link => {
        try {
          const url = new URL(link.getAttribute("href"), document.baseURI);
          if (url.protocol !== "http:" && url.protocol !== "https:") link.removeAttribute("href");
          else {
            link.href = url.href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
          }
        } catch (_) { link.removeAttribute("href"); }
      });
      element.replaceChildren(template.content);
      element.classList.add("is-rich");
      if (prepared.math.length) mountMath(element, prepared.math);
    } catch (error) {
      console.warn("StudyLab AI formatting fallback:", error?.message || "FORMAT_ERROR");
      element.classList.remove("is-rich");
      element.textContent = text;
    }
  }

  window.StudyLabAIRenderer = Object.freeze({render});
})();
