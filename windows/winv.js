// Helpers for the optional "use Win+V" setting.
//
// Windows has no "default clipboard app" setting. Its own clipboard history owns Win+V, and Windows lets you
// switch that shortcut off for your account through the DisabledHotkeys registry value (a string of letters).
// That frees Win+V so another app can use it. Only the letter V is ever added or removed here.

const KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced';
const VALUE = 'DisabledHotkeys';

// "    DisabledHotkeys    REG_SZ    VX" -> "VX"
function parseRegQuery(output) {
  const m = /DisabledHotkeys\s+REG_SZ\s*(.*)/i.exec(String(output || ''));
  return m ? m[1].trim() : '';
}

const hasLetter = (letters, letter) => String(letters).toUpperCase().includes(letter.toUpperCase());

function addLetter(letters, letter) {
  letters = String(letters || '');
  return hasLetter(letters, letter) ? letters : letters + letter.toUpperCase();
}

function removeLetter(letters, letter) {
  return String(letters || '').split('').filter((c) => c.toUpperCase() !== letter.toUpperCase()).join('');
}

module.exports = { KEY, VALUE, parseRegQuery, hasLetter, addLetter, removeLetter };
