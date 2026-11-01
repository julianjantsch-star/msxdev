(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---- idioma ----
  var lang = "pt";
  try { lang = localStorage.getItem("lang") || ""; } catch (e) { lang = ""; }
  if (!lang) lang = (navigator.language || "pt").toLowerCase().indexOf("pt") === 0 ? "pt" : "en";
  function aplicaLang(l) {
    lang = l;
    document.documentElement.lang = l === "pt" ? "pt-BR" : "en";
    $$("[data-en]").forEach(function (el) {
      if (el.dataset.pt === undefined) el.dataset.pt = el.innerHTML;
      el.innerHTML = l === "en" ? el.dataset.en : el.dataset.pt;
    });
    $$("[data-lang]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.lang === l ? "true" : "false"); });
    try { localStorage.setItem("lang", l); } catch (e) {}
  }
  $$("[data-lang]").forEach(function (b) { b.addEventListener("click", function () { aplicaLang(b.dataset.lang); }); });
  aplicaLang(lang);

  // ---- Pix (BR Code estatico, padrao EMV do Banco Central) ----
  function tlv(id, v) { var n = String(v.length); return id + (n.length < 2 ? "0" + n : n) + v; }
  function crc16(s) {
    var c = 0xFFFF;
    for (var i = 0; i < s.length; i++) {
      c ^= s.charCodeAt(i) << 8;
      for (var k = 0; k < 8; k++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF;
    }
    return ("000" + c.toString(16).toUpperCase()).slice(-4);
  }
  function limpa(s, max) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().slice(0, max);
  }
  function brCode(d, valor) {
    var s = tlv("00", "01") +
      tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", d.pixKey)) +
      tlv("52", "0000") + tlv("53", "986") +
      (valor ? tlv("54", valor.toFixed(2)) : "") +
      tlv("58", "BR") + tlv("59", limpa(d.pixName, 25)) + tlv("60", limpa(d.pixCity, 15)) +
      tlv("62", tlv("05", "***")) + "6304";
    return s + crc16(s);
  }
  window.__pix = { brCode: brCode, crc16: crc16 };

  // ---- janela de doacao ----
  var dlg = $("#doar"), D = window.DONATE || {};
  var temPix = !!(D.pixKey && D.pixName && D.pixCity), temPP = !!D.paypal, codigo = "";
  function desenhaQR(valor) {
    codigo = brCode(D, valor);
    var q = qrcode(0, "M"); q.addData(codigo, "Byte"); q.make();
    var n = q.getModuleCount(), m = 2, cv = $("#pix-qr"), e = 4;
    cv.width = cv.height = (n + m * 2) * e;
    var x = cv.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height); x.fillStyle = "#000";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect((c + m) * e, (r + m) * e, e, e);
  }
  function marcaValor(b) {
    $$("[data-valor]").forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
    desenhaQR(parseFloat(b.dataset.valor) || 0);
  }
  if (temPix) {
    $("#pix").hidden = false;
    $$("[data-valor]").forEach(function (b) { b.addEventListener("click", function () { marcaValor(b); }); });
    marcaValor($("[data-valor='40']"));
    $("#pix-copiar").addEventListener("click", function () {
      var ok = $("#pix-ok");
      var fim = function () { ok.hidden = false; setTimeout(function () { ok.hidden = true; }, 2500); };
      if (navigator.clipboard) navigator.clipboard.writeText(codigo).then(fim);
      else { var t = document.createElement("textarea"); t.value = codigo; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); fim(); }
    });
  }
  if (temPP) { $("#paypal").hidden = false; $("#paypal a").href = D.paypal; }

  var OFERTA = ["Muamba!", "Orion Wave", "Sudoku", "Dominó"];
  function mostraPedido(jogo) {
    var vale = jogo !== null;
    $("#pedido").hidden = !vale;
    if (vale && jogo) $("#pedido-jogo").value = jogo;
    if (vale) { $("#pedido-form").hidden = false; $("#pedido-ok").hidden = true; }
  }
  function abre(nome, tam, href, jogo) {
    var baixar = $("#doar-baixar");
    mostraPedido(jogo === undefined ? null : jogo);
    if (temPix && jogo !== undefined) marcaValor($("[data-valor='40']"));
    if (href) {
      $("#doar-titulo").innerHTML = nome;
      $("#doar-tam").textContent = tam;
      baixar.href = href; baixar.setAttribute("download", ""); baixar.hidden = false;
      $("#doar-dl").hidden = false; $("#doar-geral").hidden = true;
    } else {
      baixar.hidden = true; $("#doar-dl").hidden = true; $("#doar-geral").hidden = false;
    }
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  }
  function fecha() { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); }
  $("#doar-fechar").addEventListener("click", fecha);
  dlg.addEventListener("click", function (e) { if (e.target === dlg) fecha(); });

  // cada download passa pela janela; sem Pix e PayPal configurados o link baixa direto
  if (temPix || temPP) {
    $$("a[data-dl]").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); abre(a.dataset.dl, a.dataset.tam, a.getAttribute("href"), OFERTA.indexOf(a.dataset.dl) >= 0 ? a.dataset.dl : undefined); });
    });
    $$("[data-apoiar]").forEach(function (b) { b.addEventListener("click", function () { abre(); }); });
    $$("[data-oferta]").forEach(function (b) { b.addEventListener("click", function () { abre(undefined, undefined, undefined, b.dataset.oferta); }); });
    var tipo = $("#pedido-tipo"), enviou = false;
    tipo.addEventListener("change", function () {
      var rom = tipo.selectedIndex === 0;
      $("#pedido-nome-box").hidden = !rom; $("#pedido-nome").required = rom;
      $("#pedido-det-box").hidden = rom; $("#pedido-det").required = !rom;
    });
    $("#pedido-form").addEventListener("submit", function () { enviou = true; $("#pedido-enviar").disabled = true; });
    $("#pedido-alvo").addEventListener("load", function () {
      if (!enviou) return;
      enviou = false;
      $("#pedido-form").reset(); $("#pedido-enviar").disabled = false;
      $("#pedido-form").hidden = true; $("#pedido-ok").hidden = false;
    });
  } else {
    $$("[data-apoiar],[data-oferta]").forEach(function (b) { b.hidden = true; });
  }
})();
