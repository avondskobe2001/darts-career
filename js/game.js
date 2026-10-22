/* Darts Career Mode — main app (nl-BE) */
(function () {
  const SAVE_KEY = 'darts_career_kobe_v1';
  const DATA = window.DARTS_DATA;
  const ME = window.MatchEngine;

  let state = null;
  let board = null;
  let match = null;
  let tourney = null;
  let timing = { active: false, pos: 0, dir: 1, raf: null };

  function defaultCareer(name) {
    return {
      name: name || 'Kobe',
      stats: { ...DATA.startingStats },
      xp: 40,
      money: 0,
      rankPoints: 0,
      wins: 0,
      losses: 0,
      titles: [],
      unlocks: { challenge: false, players_champ: false, euro_tour: false, world_matchplay: false, world_champ: false },
      history: [],
      createdAt: Date.now(),
    };
  }

  function save() {
    if (!state) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function resetCareer() {
    localStorage.removeItem(SAVE_KEY);
    state = null;
    showScreen('splash');
  }

  function worldRank() {
    const pts = state.rankPoints;
    if (pts >= 800) return 1;
    if (pts >= 500) return Math.max(2, 8 - Math.floor((pts - 500) / 50));
    if (pts >= 250) return Math.max(8, 20 - Math.floor((pts - 250) / 25));
    if (pts >= 100) return Math.max(20, 40 - Math.floor((pts - 100) / 10));
    if (pts >= 40) return Math.max(40, 80 - Math.floor((pts - 40) / 3));
    if (pts >= 10) return Math.max(80, 120 - pts);
    return Math.min(200, 150 - Math.floor(pts / 2));
  }

  function overallSkill() {
    const s = state.stats;
    return Math.round(s.accuracy * 0.25 + s.checkout * 0.2 + s.consistency * 0.2 + s.scoring * 0.25 + s.experience * 0.1);
  }

  function formatMoney(n) {
    return n.toLocaleString('nl-BE');
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
    const scr = document.getElementById('screen-' + id);
    if (scr) scr.classList.add('active');
    const top = document.getElementById('topbar');
    if (id === 'splash') top.classList.add('hidden');
    else top.classList.remove('hidden');
    refreshTopbar();
    if (id === 'hub') renderHub();
    if (id === 'upgrade') renderUpgrade();
    if (id === 'tournaments') renderTournaments();
    if (id === 'stats') renderStatsPage();
  }

  function refreshTopbar() {
    if (!state) return;
    document.getElementById('tb-name').textContent = state.name;
    document.getElementById('tb-xp').textContent = state.xp;
    document.getElementById('tb-money').textContent = '€' + formatMoney(state.money);
    document.getElementById('tb-rank').textContent = '#' + worldRank();
  }

  function startCareer() {
    const name = (document.getElementById('player-name').value || 'Kobe').trim().slice(0, 24);
    state = defaultCareer(name);
    save();
    showScreen('hub');
  }

  function renderHub() {
    document.getElementById('hub-greeting').textContent = `Welkom terug, ${state.name}`;
    document.getElementById('hub-rank').textContent = `Wereldranglijst #${worldRank()}`;
    document.getElementById('hub-skill').textContent = overallSkill();
    document.getElementById('hub-record').textContent = `${state.wins}W – ${state.losses}L`;
    document.getElementById('hub-titles').textContent = state.titles.length ? state.titles.join(', ') : 'Nog geen titels';
    document.getElementById('hub-xp').textContent = state.xp + ' XP';
    document.getElementById('hub-pills').innerHTML = DATA.stats.map((st) =>
      `<span class="pill">${st.name}: <b>${state.stats[st.key]}</b></span>`
    ).join('');

    const hist = document.getElementById('hub-history');
    if (!state.history.length) {
      hist.innerHTML = '<p class="muted">Nog geen wedstrijden. Ga een toernooi in!</p>';
    } else {
      hist.innerHTML = state.history.slice(0, 8).map((h) =>
        `<div class="history-item"><span>${h.tournament} vs ${h.opp}</span><span class="${h.won ? 'w' : 'l'}">${h.score} ${h.won ? 'W' : 'L'} · +${h.xp} XP</span></div>`
      ).join('');
    }
  }

  function renderUpgrade() {
    document.getElementById('upg-xp').textContent = state.xp;
    const box = document.getElementById('upgrade-list');
    box.innerHTML = DATA.stats.map((st) => {
      const val = state.stats[st.key];
      const cost = DATA.upgradeCost(val);
      const maxed = val >= 99;
      return `<div class="stat-row">
        <div class="stat-name">${st.name}<small>${st.desc}</small></div>
        <div class="bar-track"><div class="bar-fill" style="width:${val}%"></div></div>
        <div style="display:flex;align-items:center;gap:.35rem">
          <span class="stat-val">${val}</span>
          ${maxed ? '<span class="tag">MAX</span>' :
            `<span class="upgrade-cost">${cost} XP</span>
             <button type="button" class="btn btn-sm btn-gold" data-stat="${st.key}" ${state.xp < cost ? 'disabled' : ''}>+</button>`}
        </div>
      </div>`;
    }).join('');
    box.querySelectorAll('button[data-stat]').forEach((btn) => {
      btn.addEventListener('click', () => upgradeStat(btn.dataset.stat));
    });
  }

  function upgradeStat(key) {
    const val = state.stats[key];
    if (val >= 99) return;
    const cost = DATA.upgradeCost(val);
    if (state.xp < cost) return;
    state.xp -= cost;
    state.stats[key] = Math.min(99, val + 1);
    if (state.stats[key] % 5 === 0 && key !== 'experience') {
      state.stats.experience = Math.min(99, state.stats.experience + 1);
    }
    save();
    renderUpgrade();
    refreshTopbar();
  }

  function isUnlocked(t) {
    if (t.id === 'local_open') return true;
    const r = worldRank();
    if (r <= t.minRank) return true;
    if (t.id === 'challenge' && (state.wins >= 3 || state.unlocks.challenge || state.rankPoints >= 15)) return true;
    if (t.id === 'players_champ' && (state.unlocks.players_champ || state.titles.includes('Challenge Tour') || state.rankPoints >= 40)) return true;
    if (t.id === 'euro_tour' && (state.unlocks.euro_tour || state.titles.includes('Players Championship') || state.rankPoints >= 100)) return true;
    if (t.id === 'world_matchplay' && (state.unlocks.world_matchplay || state.titles.includes('European Tour') || state.rankPoints >= 220)) return true;
    if (t.id === 'world_champ' && (state.unlocks.world_champ || state.titles.includes('World Matchplay') || state.rankPoints >= 400)) return true;
    return false;
  }

  function renderTournaments() {
    const box = document.getElementById('tour-list');
    box.innerHTML = DATA.tournaments.map((t) => {
      const open = isUnlocked(t);
      return `<div class="tour-card ${open ? '' : 'locked'}" data-id="${t.id}">
        <span class="tour-tier tier-${t.tier}">Tier ${t.tier}</span>
        <h4>${t.name}</h4>
        <div class="tour-meta">
          <span>Best of ${t.bestOf}</span>
          <span>Veld: ${t.fieldSize}</span>
          <span>1e prijs: €${formatMoney(t.prize[0])}</span>
        </div>
        <p class="muted" style="font-size:.75rem;margin-top:.4rem">${open ? 'Klik om in te schrijven' : '🔒 ' + t.unlockMsg}</p>
      </div>`;
    }).join('');
    box.querySelectorAll('.tour-card:not(.locked)').forEach((el) => {
      el.addEventListener('click', () => startTournament(el.dataset.id));
    });
  }

  function pickField(t) {
    const [lo, hi] = t.skillRange;
    let pool = DATA.players.filter((p) => p.skill >= lo - 5 && p.skill <= hi + 4);
    if (pool.length < 7) pool = DATA.players.slice();
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    const field = [];
    const used = new Set();
    for (const p of shuffled) {
      if (field.length >= 7) break;
      if (used.has(p.id)) continue;
      used.add(p.id);
      field.push({ ...p });
    }
    while (field.length < 7) {
      const p = DATA.players[Math.floor(Math.random() * DATA.players.length)];
      field.push({ ...p, id: p.id + '_x' + field.length });
    }
    // sort ascending skill so later rounds face stronger names
    field.sort((a, b) => a.skill - b.skill);
    return field;
  }

  function startTournament(id) {
    const t = DATA.tournaments.find((x) => x.id === id);
    if (!t || !isUnlocked(t)) return;
    const field = pickField(t);
    // Your path: QF (weaker), SF (mid), Final (strongest of path)
    // Also show full field for flavour
    const path = [field[1] || field[0], field[3] || field[2], field[6] || field[5]];
    tourney = {
      def: t,
      round: 0,
      roundNames: ['Kwartfinale', 'Halve finale', 'Finale'],
      field,
      path,
      placed: null,
      finished: false,
    };
    renderBracketThenPlay();
  }

  function renderBracketThenPlay() {
    showScreen('bracket');
    const t = tourney.def;
    document.getElementById('bracket-title').textContent = t.name;
    document.getElementById('bracket-round').textContent = tourney.roundNames[tourney.round];
    const list = document.getElementById('bracket-list');
    const nextOpp = tourney.path[tourney.round];
    list.innerHTML = `
      <li><span class="you">${state.name} (jij)</span><span class="tag">Skill ${overallSkill()}</span></li>
      <li style="background:rgba(230,57,70,.08)"><span>Volgende: <strong>${nextOpp.name}</strong> (${nextOpp.country})</span><span>skill ${nextOpp.skill}</span></li>
      ${tourney.field.map((p) => {
        const inPath = tourney.path.some((x) => x.id === p.id);
        const played = tourney.path.findIndex((x) => x.id === p.id);
        const done = played >= 0 && played < tourney.round;
        return `<li style="${done ? 'opacity:.45' : ''}"><span>${p.name} <small class="muted">${p.country}</small>${inPath ? ' · pad' : ''}</span><span>skill ${p.skill}${done ? ' · gespeeld' : ''}</span></li>`;
      }).join('')}
    `;
    document.getElementById('bracket-alive').textContent =
      `Ronde ${tourney.round + 1}/3 · Best of ${t.bestOf}`;
  }

  function beginNextMatch() {
    if (tourney.finished) {
      showScreen('hub');
      return;
    }
    const opp = tourney.path[tourney.round];
    match = ME.createMatch({
      bestOf: tourney.def.bestOf,
      youName: state.name,
      youStats: { ...state.stats },
      oppName: opp.name,
      oppSkill: opp.skill,
    });
    match._opp = opp;
    match._roundName = tourney.roundNames[tourney.round];
    showScreen('match');
    initMatchUI();
  }

  function initMatchUI() {
    document.getElementById('match-round-label').textContent =
      `${tourney.def.name} · ${match._roundName}`;
    document.getElementById('m-you-name').textContent = match.you.name;
    document.getElementById('m-opp-name').textContent = match.opp.name;
    updateScoreboard();
    clearLog();
    log(`Best of ${match.bestOf} — eerst tot ${match.legsToWin} legs. Succes, ${state.name}!`);

    const canvas = document.getElementById('dartboard');
    if (!board) board = DartBoard.create(canvas);
    else board.draw();
    board.clearHits();
    board.setLocked(false);
    board.setOnThrow(onPlayerAimClick);

    document.getElementById('btn-sim-match').onclick = () => simulateRestOfMatch();
    document.getElementById('suggest-target').textContent = '';

    setThrowPrompt();
    startTiming();
  }

  function updateScoreboard() {
    document.getElementById('m-you-rem').textContent = match.you.remaining;
    document.getElementById('m-opp-rem').textContent = match.opp.remaining;
    document.getElementById('m-you-legs').textContent = match.you.legs;
    document.getElementById('m-opp-legs').textContent = match.opp.legs;
    document.getElementById('m-legs-need').textContent = match.legsToWin;
    renderPips();
  }

  function renderPips() {
    const pips = document.getElementById('dart-pips');
    pips.innerHTML = [0, 1, 2].map((i) => {
      const d = match.visitDarts[i];
      if (!d) return `<div class="pip">${i + 1}</div>`;
      return `<div class="pip hit">${d.label}</div>`;
    }).join('');
    document.getElementById('visit-score').textContent = match.visitScore ? `Visit: ${match.visitScore}` : '';
  }

  function log(msg, hl) {
    const el = document.getElementById('match-log');
    const div = document.createElement('div');
    if (hl) div.className = 'hl';
    div.textContent = msg;
    el.prepend(div);
  }
  function clearLog() { document.getElementById('match-log').innerHTML = ''; }

  function setThrowPrompt() {
    const info = document.getElementById('throw-info');
    if (!match || match.over) {
      info.innerHTML = `<div class="big">Wedstrijd afgelopen</div>`;
      return;
    }
    if (match.turn === 'you') {
      const tgt = ME.preferredTarget(match.you.remaining, match.dartsLeft);
      if (tgt) {
        const lab = tgt.seg === 25 ? (tgt.mult === 2 ? 'Bull' : 'Outer Bull') :
          (tgt.mult === 3 ? 'T' : tgt.mult === 2 ? 'D' : '') + tgt.seg;
        document.getElementById('suggest-target').textContent =
          `Advies: ${lab} · ${match.dartsLeft} pijl(en) · rest ${match.you.remaining}`;
      }
      info.innerHTML = `<div class="big">Jouw beurt</div><div class="aim-hint">Richt op het bord en klik — timing in het midden = preciezer</div>`;
      board.setLocked(false);
      startTiming();
    } else {
      document.getElementById('suggest-target').textContent = '';
      info.innerHTML = `<div class="big">${match.opp.name} gooit…</div>`;
      board.setLocked(true);
      stopTiming();
      setTimeout(doAIVisit, 550);
    }
  }

  function startTiming() {
    stopTiming();
    timing.active = true;
    timing.pos = Math.random() * 100;
    timing.dir = 1;
    const bar = document.getElementById('timing-bar');
    document.getElementById('timing-wrap').classList.remove('hidden');
    function tick() {
      if (!timing.active) return;
      timing.pos += timing.dir * 2.1;
      if (timing.pos >= 100) { timing.pos = 100; timing.dir = -1; }
      if (timing.pos <= 0) { timing.pos = 0; timing.dir = 1; }
      bar.style.left = `calc(${timing.pos}% - 4%)`;
      timing.raf = requestAnimationFrame(tick);
    }
    timing.raf = requestAnimationFrame(tick);
  }
  function stopTiming() {
    timing.active = false;
    if (timing.raf) cancelAnimationFrame(timing.raf);
  }
  function timingQuality() {
    return Math.max(0, 1 - Math.abs(timing.pos - 50) / 50);
  }

  function onPlayerAimClick(x, y) {
    if (!match || match.over || match.turn !== 'you') return;
    ME.updatePressure(match);
    const q = timingQuality();
    const wobble = ME.humanWobble(state.stats, q, match.pressure);
    const result = board.applyThrow(x, y, wobble, '#4a9eff');
    resolvePlayerDart(result);
  }

  function resolvePlayerDart(result) {
    const visitStart = match.you.remaining + match.visitScore;
    const applied = ME.applyDart(match.you.remaining, result);
    match.visitDarts.push(result);
    if (applied.bust) {
      log(`BUST! ${result.label} — terug naar ${visitStart}`);
      match.you.remaining = visitStart;
      match.visitScore = 0;
      match.visitDarts = [];
      match.dartsLeft = 3;
      updateScoreboard();
      endVisit('you');
      return;
    }
    match.you.remaining = applied.remaining;
    match.visitScore += result.score;
    match.dartsLeft--;
    log(`Jij: ${result.label} (${result.score}) → ${match.you.remaining}`);
    updateScoreboard();

    if (applied.checkout) {
      log(`CHECKOUT! Leg binnen!`, true);
      match.you.legs++;
      updateScoreboard();
      if (match.you.legs >= match.legsToWin) {
        finishMatch(true);
        return;
      }
      nextLeg();
      return;
    }
    if (match.dartsLeft <= 0) endVisit('you');
    else setThrowPrompt();
  }

  function endVisit(who) {
    match.visitScore = 0;
    match.visitDarts = [];
    match.dartsLeft = 3;
    board.clearHits();
    match.turn = who === 'you' ? 'opp' : 'you';
    updateScoreboard();
    setThrowPrompt();
  }

  function nextLeg() {
    match.you.remaining = 501;
    match.opp.remaining = 501;
    match.visitScore = 0;
    match.visitDarts = [];
    match.dartsLeft = 3;
    board.clearHits();
    match.starter = match.starter === 'you' ? 'opp' : 'you';
    match.turn = match.starter;
    log(`—— Nieuwe leg (${match.you.legs}–${match.opp.legs}) ——`);
    updateScoreboard();
    setThrowPrompt();
  }

  function doAIVisit() {
    if (!match || match.over || match.turn !== 'opp') return;
    ME.updatePressure(match);
    const profile = match.opp.profile;
    let darts = 3;
    const startRem = match.opp.remaining;

    function throwOne() {
      if (match.over || match.turn !== 'opp') return;
      const dart = ME.aiThrow(match.opp.remaining, darts, profile, match.pressure * 0.8);
      board.showAIHit(dart, '#e63946');
      const applied = ME.applyDart(match.opp.remaining, dart);
      match.visitDarts.push(dart);

      if (applied.bust) {
        log(`${match.opp.name}: BUST op ${dart.label}`);
        match.opp.remaining = startRem;
        match.visitScore = 0;
        match.visitDarts = [];
        match.dartsLeft = 3;
        updateScoreboard();
        setTimeout(() => endVisit('opp'), 450);
        return;
      }
      match.opp.remaining = applied.remaining;
      match.visitScore += dart.score;
      darts--;
      match.dartsLeft = darts;
      log(`${match.opp.name}: ${dart.label} (${dart.score}) → ${match.opp.remaining}`);
      updateScoreboard();

      if (applied.checkout) {
        log(`Checkout ${match.opp.name}!`, true);
        match.opp.legs++;
        updateScoreboard();
        if (match.opp.legs >= match.legsToWin) {
          finishMatch(false);
          return;
        }
        setTimeout(() => nextLeg(), 650);
        return;
      }
      if (darts <= 0) setTimeout(() => endVisit('opp'), 400);
      else setTimeout(throwOne, 400);
    }
    throwOne();
  }

  function autoVisit(who) {
    const isYou = who === 'you';
    const player = isYou ? match.you : match.opp;
    const profile = isYou ? ME.profileFromStats(state.stats) : match.opp.profile;
    ME.updatePressure(match);
    let darts = 3;
    const startRem = player.remaining;
    while (darts > 0 && !match.over) {
      const dart = ME.aiThrow(player.remaining, darts, profile, match.pressure * (isYou ? 0.65 : 0.8));
      if (isYou) {
        const sz = board.getSize();
        board.applyThrow(sz / 2, sz * 0.28, 28, '#4a9eff');
      } else board.showAIHit(dart, '#e63946');
      const applied = ME.applyDart(player.remaining, dart);
      if (applied.bust) {
        player.remaining = startRem;
        log(`${player.name}: BUST`);
        break;
      }
      player.remaining = applied.remaining;
      log(`${player.name}: ${dart.label} → ${player.remaining}`);
      darts--;
      if (applied.checkout) {
        player.legs++;
        log(`Leg: ${player.name}`, true);
        updateScoreboard();
        if (player.legs >= match.legsToWin) {
          finishMatch(isYou);
          return;
        }
        match.you.remaining = 501;
        match.opp.remaining = 501;
        match.starter = match.starter === 'you' ? 'opp' : 'you';
        match.turn = match.starter;
        match.visitScore = 0;
        match.visitDarts = [];
        match.dartsLeft = 3;
        board.clearHits();
        updateScoreboard();
        return;
      }
    }
    match.visitScore = 0;
    match.visitDarts = [];
    match.dartsLeft = 3;
    match.turn = isYou ? 'opp' : 'you';
    board.clearHits();
    updateScoreboard();
  }

  function simulateRestOfMatch() {
    if (!match || match.over) return;
    stopTiming();
    board.setLocked(true);
    document.getElementById('throw-info').innerHTML = '<div class="big">Simuleren…</div>';
    let guard = 0;
    function loop() {
      if (match.over || guard++ > 500) {
        if (!match.over) finishMatch(match.you.legs >= match.opp.legs);
        return;
      }
      autoVisit(match.turn);
      if (!match.over) setTimeout(loop, 30);
    }
    loop();
  }

  function finishMatch(youWon) {
    if (match.over) return;
    match.over = true;
    match.winner = youWon ? 'you' : 'opp';
    stopTiming();
    board.setLocked(true);
    const score = `${match.you.legs}–${match.opp.legs}`;
    log(youWon ? `🏆 JE WINT ${score}!` : `Verloren ${score}`, true);

    const roundWon = tourney.round;
    if (youWon) {
      if (tourney.round >= 2) {
        tourney.placed = 1;
        tourney.finished = true;
      } else {
        tourney.round++;
      }
    } else {
      // place: round 0 loss → 4 (QF), 1 → 3 (SF), 2 → 2 (finalist)
      tourney.placed = 4 - tourney.round;
      if (tourney.placed < 2) tourney.placed = 2;
      tourney.finished = true;
    }
    setTimeout(() => showMatchResult(youWon, score, roundWon), 700);
  }

  function showMatchResult(won, score, roundIdx) {
    showScreen('result');
    const t = tourney.def;
    const skillBonus = Math.max(0, Math.floor((match.opp.skill - overallSkill()) / 4));
    let xp = 0, money = 0, points = 0;
    const cont = !tourney.finished && won;

    if (tourney.finished) {
      if (tourney.placed === 1) {
        xp = t.xpWin[0]; money = t.prize[0]; points = t.points[0];
      } else if (tourney.placed === 2) {
        xp = t.xpWin[1]; money = t.prize[1]; points = t.points[1];
      } else if (tourney.placed === 3) {
        xp = Math.max(t.xpWin[2] - 8, t.xpLoss[2]); money = t.prize[2]; points = t.points[2];
      } else {
        xp = t.xpLoss[3]; money = t.prize[3]; points = t.points[3];
      }
      // unlocks / titles
      if (tourney.placed === 1) {
        if (!state.titles.includes(t.name)) state.titles.push(t.name);
        if (t.id === 'local_open') state.unlocks.challenge = true;
        if (t.id === 'challenge') state.unlocks.players_champ = true;
        if (t.id === 'players_champ') state.unlocks.euro_tour = true;
        if (t.id === 'euro_tour') state.unlocks.world_matchplay = true;
        if (t.id === 'world_matchplay') state.unlocks.world_champ = true;
      }
    } else {
      // interim round win
      xp = Math.floor(t.xpWin[Math.min(roundIdx + 1, 3)] * 0.4) + 10;
      money = 0;
      points = Math.floor(t.points[3] / 2);
    }

    xp += skillBonus + (won ? 4 : 0);
    state.xp += xp;
    state.money += money;
    state.rankPoints += points;
    if (won) state.wins++; else state.losses++;

    state.history.unshift({
      tournament: t.name + ' (' + (match._roundName || '') + ')',
      opp: match.opp.name,
      score,
      won,
      xp,
      at: Date.now(),
    });
    if (state.history.length > 40) state.history.pop();
    save();

    const banner = document.getElementById('result-banner');
    banner.className = 'result-banner ' + (won ? 'win' : 'loss');
    let title = won ? 'Wedstrijd gewonnen!' : 'Wedstrijd verloren';
    if (tourney.finished && tourney.placed === 1) title = '🏆 TOERNOOI GEWONNEN!';
    else if (tourney.finished && tourney.placed === 2) title = 'Zilver — verloren in de finale';
    else if (tourney.finished && tourney.placed === 3) title = 'Halve finale bereikt';
    document.getElementById('result-title').textContent = title;
    document.getElementById('result-sub').textContent = `${score} vs ${match.opp.name}`;
    document.getElementById('result-rewards').innerHTML = `
      <div class="reward-item"><div class="val">+${xp}</div><div class="lbl">XP</div></div>
      <div class="reward-item"><div class="val">€${formatMoney(money)}</div><div class="lbl">Prijs</div></div>
      <div class="reward-item"><div class="val">+${points}</div><div class="lbl">Ranking pts</div></div>
      <div class="reward-item"><div class="val">#${worldRank()}</div><div class="lbl">Rang</div></div>
    `;

    const btnCont = document.getElementById('btn-continue-tour');
    if (cont) {
      btnCont.classList.remove('hidden');
      btnCont.onclick = () => renderBracketThenPlay();
    } else {
      btnCont.classList.add('hidden');
    }
    document.getElementById('btn-result-hub').onclick = () => { tourney = null; showScreen('hub'); };
    document.getElementById('btn-result-upgrade').onclick = () => { showScreen('upgrade'); };
    refreshTopbar();
  }

  function renderStatsPage() {
    document.getElementById('stats-body').innerHTML = `
      <div class="grid-2">
        <div class="panel">
          <h3>Carrière</h3>
          <p><strong>${state.name}</strong></p>
          <p class="muted">Skill overall: ${overallSkill()} · Rang #${worldRank()}</p>
          <p>Record: ${state.wins}W – ${state.losses}L</p>
          <p>Prijs­geld: €${formatMoney(state.money)}</p>
          <p>Ranking points: ${state.rankPoints}</p>
          <p>Titels: ${state.titles.length ? state.titles.join(', ') : '—'}</p>
        </div>
        <div class="panel">
          <h3>Attributes</h3>
          ${DATA.stats.map((st) => `
            <div class="stat-row">
              <div class="stat-name">${st.name}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${state.stats[st.key]}%"></div></div>
              <span class="stat-val">${state.stats[st.key]}</span>
            </div>`).join('')}
        </div>
      </div>
      <div class="panel mt-1">
        <h3>PDC-roster (${DATA.players.length} spelers)</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.35rem;font-size:.85rem;max-height:280px;overflow:auto">
          ${DATA.players.slice().sort((a,b)=>b.skill-a.skill).map((p) =>
            `<div>${p.name} <span class="muted">${p.country} · ${p.skill}</span></div>`
          ).join('')}
        </div>
      </div>
    `;
  }

  function init() {
    document.getElementById('btn-start').addEventListener('click', startCareer);
    document.getElementById('btn-continue').addEventListener('click', () => {
      state = load();
      if (state) showScreen('hub');
    });
    document.getElementById('nav-hub').addEventListener('click', () => showScreen('hub'));
    document.getElementById('nav-upgrade').addEventListener('click', () => showScreen('upgrade'));
    document.getElementById('nav-tour').addEventListener('click', () => showScreen('tournaments'));
    document.getElementById('nav-stats').addEventListener('click', () => showScreen('stats'));
    document.getElementById('btn-reset').addEventListener('click', () => {
      if (confirm('Carrière wissen? Dit kan niet ongedaan worden.')) resetCareer();
    });
    document.getElementById('btn-play-match').addEventListener('click', beginNextMatch);

    const existing = load();
    if (existing) {
      document.getElementById('btn-continue').classList.remove('hidden');
      document.getElementById('btn-continue-wrap').classList.remove('hidden');
      document.getElementById('continue-name').textContent = existing.name;
    }
    showScreen('splash');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
