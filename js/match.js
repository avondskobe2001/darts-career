/* 501 match engine + AI throws */
window.MatchEngine = (function () {
  const CHECKOUTS = buildCheckoutTable();

  function buildCheckoutTable() {
    const map = {};
    function add(darts) {
      const score = darts.reduce((s, d) => {
        if (d.seg === 25) return s + (d.mult === 2 ? 50 : 25);
        return s + d.seg * d.mult;
      }, 0);
      if (score < 2 || score > 170) return;
      if (!map[score] || darts.length < map[score].length) map[score] = darts;
    }

    // doubles / bull
    for (let d = 1; d <= 20; d++) add([{ seg: d, mult: 2 }]);
    add([{ seg: 25, mult: 2 }]);

    // 2-dart finishes
    for (let a = 1; a <= 20; a++) {
      for (let ma = 1; ma <= 3; ma++) {
        for (let d = 1; d <= 20; d++) {
          add([{ seg: a, mult: ma }, { seg: d, mult: 2 }]);
        }
        add([{ seg: a, mult: ma }, { seg: 25, mult: 2 }]);
      }
    }

    // 3-dart finishes (common patterns)
    for (let a = 1; a <= 20; a++) {
      for (let b = 1; b <= 20; b++) {
        for (let d = 1; d <= 20; d++) {
          add([{ seg: a, mult: 3 }, { seg: b, mult: 3 }, { seg: d, mult: 2 }]);
          add([{ seg: a, mult: 3 }, { seg: b, mult: 1 }, { seg: d, mult: 2 }]);
          add([{ seg: a, mult: 3 }, { seg: b, mult: 2 }, { seg: d, mult: 2 }]);
        }
        add([{ seg: a, mult: 3 }, { seg: b, mult: 3 }, { seg: 25, mult: 2 }]);
        add([{ seg: a, mult: 3 }, { seg: b, mult: 1 }, { seg: 25, mult: 2 }]);
        add([{ seg: a, mult: 1 }, { seg: b, mult: 1 }, { seg: 25, mult: 2 }]);
      }
    }

    // Force classic routes (prefer shorter / iconic)
    const classics = [
      [{ seg: 20, mult: 3 }, { seg: 20, mult: 3 }, { seg: 25, mult: 2 }], // 170
      [{ seg: 20, mult: 3 }, { seg: 19, mult: 3 }, { seg: 25, mult: 2 }], // 167
      [{ seg: 20, mult: 3 }, { seg: 18, mult: 3 }, { seg: 25, mult: 2 }], // 164
      [{ seg: 20, mult: 3 }, { seg: 17, mult: 3 }, { seg: 25, mult: 2 }], // 161
      [{ seg: 20, mult: 3 }, { seg: 20, mult: 3 }, { seg: 20, mult: 2 }], // 160
      [{ seg: 20, mult: 3 }, { seg: 19, mult: 3 }, { seg: 18, mult: 2 }], // 157
      [{ seg: 20, mult: 3 }, { seg: 20, mult: 3 }, { seg: 16, mult: 2 }], // 152
      [{ seg: 20, mult: 3 }, { seg: 19, mult: 1 }, { seg: 16, mult: 2 }], // 121? 60+19+32=111 — skip forced wrong
      [{ seg: 20, mult: 3 }, { seg: 11, mult: 1 }, { seg: 25, mult: 2 }], // 121
      [{ seg: 20, mult: 3 }, { seg: 20, mult: 2 }], // 100
      [{ seg: 20, mult: 3 }, { seg: 10, mult: 2 }], // 80
      [{ seg: 20, mult: 1 }, { seg: 20, mult: 2 }], // 60
      [{ seg: 20, mult: 3 }, { seg: 8, mult: 2 }], // 76
      [{ seg: 20, mult: 3 }, { seg: 4, mult: 2 }], // 68
      [{ seg: 20, mult: 3 }, { seg: 20, mult: 1 }, { seg: 16, mult: 2 }], // 116? 60+20+32=112
      [{ seg: 20, mult: 2 }], // 40
      [{ seg: 16, mult: 2 }], // 32
      [{ seg: 8, mult: 2 }], // 16
    ];
    classics.forEach((route) => {
      const score = route.reduce((s, d) => s + (d.seg === 25 ? (d.mult === 2 ? 50 : 25) : d.seg * d.mult), 0);
      map[score] = route; // prefer classic
    });

    return map;
  }

  function preferredTarget(remaining, dartsLeft) {
    if (remaining > 170 || remaining <= 1) return { seg: 20, mult: 3, reason: 'score' };

    if (CHECKOUTS[remaining] && CHECKOUTS[remaining].length <= dartsLeft) {
      return { ...CHECKOUTS[remaining][0], reason: 'checkout' };
    }

    // set up: with 1 dart left on high score, just hit T20
    if (dartsLeft === 1) {
      if (remaining <= 40 && remaining % 2 === 0) return { seg: remaining / 2, mult: 2, reason: 'checkout' };
      if (remaining === 50) return { seg: 25, mult: 2, reason: 'checkout' };
      return { seg: 20, mult: 3, reason: 'score' };
    }

    // leave a nice double when possible
    if (remaining <= 60 && remaining > 40 && dartsLeft >= 2) {
      const need = remaining - 40; // prefer leave 40
      if (need >= 1 && need <= 20) return { seg: need, mult: 1, reason: 'setup' };
    }

    const bogeys = [159, 162, 163, 165, 166, 168, 169];
    if (bogeys.includes(remaining)) return { seg: 19, mult: 3, reason: 'score' };

    return { seg: 20, mult: 3, reason: 'score' };
  }

  function profileFromStats(stats) {
    return {
      accuracy: stats.accuracy / 100,
      checkout: stats.checkout / 100,
      consistency: stats.consistency / 100,
      scoring: stats.scoring / 100,
      experience: stats.experience / 100,
      skill:
        stats.accuracy * 0.25 +
        stats.checkout * 0.2 +
        stats.consistency * 0.2 +
        stats.scoring * 0.25 +
        stats.experience * 0.1,
    };
  }

  function profileFromSkill(skill) {
    const base = skill;
    return profileFromStats({
      accuracy: clamp(base - 5 + rand(-3, 3), 30, 99),
      checkout: clamp(base - 8 + rand(-4, 4), 25, 98),
      consistency: clamp(base - 6 + rand(-3, 3), 30, 98),
      scoring: clamp(base - 4 + rand(-3, 3), 30, 99),
      experience: clamp(base - 10 + rand(-5, 5), 20, 95),
    });
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function chance(p) { return Math.random() < p; }

  function aiThrow(remaining, dartsLeft, profile, pressure) {
    pressure = pressure || 0;
    const target = preferredTarget(remaining, dartsLeft);
    const nerve = profile.consistency * (1 - pressure * 0.5) + profile.experience * 0.3;
    const finishing =
      target.reason === 'checkout' ||
      (target.mult === 2 && (remaining === target.seg * 2 || (target.seg === 25 && remaining === 50)));

    if (finishing) {
      const successP = clamp(
        profile.checkout * 0.55 + nerve * 0.25 + profile.accuracy * 0.2 - pressure * 0.15,
        0.08,
        0.72
      );
      if (chance(successP)) return makeResult(target.seg, 2);
      if (chance(0.45 + profile.accuracy * 0.2)) return makeResult(target.seg === 25 ? 20 : target.seg, 1);
      if (chance(0.3)) {
        const adj = adjacent(target.seg === 25 ? 20 : target.seg);
        return makeResult(adj, chance(0.35) ? 2 : 1);
      }
      return makeResult(0, 0);
    }

    const wantMult = target.mult || 3;
    const wantSeg = target.seg || 20;

    if (wantMult === 3) {
      const tP = clamp(0.12 + profile.scoring * 0.45 + profile.accuracy * 0.2 - pressure * 0.1, 0.08, 0.55);
      if (chance(tP)) return makeResult(wantSeg, 3);
      if (chance(0.55 + profile.accuracy * 0.25)) return makeResult(wantSeg, 1);
      const adj = adjacent(wantSeg);
      if (chance(0.5)) return makeResult(adj, chance(0.15 + profile.scoring * 0.2) ? 3 : 1);
      if (chance(0.08)) return makeResult(wantSeg, 2);
      return makeResult(adj, 1);
    }

    if (wantMult === 1) {
      if (chance(0.78 + profile.accuracy * 0.18)) return makeResult(wantSeg, 1);
      return makeResult(adjacent(wantSeg), 1);
    }

    if (wantSeg === 25) {
      const bullP = clamp(profile.checkout * 0.35 + profile.accuracy * 0.25, 0.05, 0.4);
      if (chance(bullP * 0.45)) return makeResult(25, 2);
      if (chance(bullP)) return makeResult(25, 1);
      return makeResult(chance(0.5) ? 20 : 1, 1);
    }

    return makeResult(20, 1);
  }

  function adjacent(seg) {
    if (seg === 25 || seg === 0) return 20;
    const order = DartBoard.SEGMENTS;
    const i = order.indexOf(seg);
    if (i < 0) return 20;
    return order[(i + (chance(0.5) ? 1 : -1) + 20) % 20];
  }

  function makeResult(seg, mult) {
    if (seg === 0 || mult === 0) return { score: 0, label: 'Mis', mult: 0, segment: 0 };
    if (seg === 25) {
      if (mult === 2) return { score: 50, label: 'Bull!', mult: 2, segment: 25 };
      return { score: 25, label: 'Outer Bull', mult: 1, segment: 25 };
    }
    const label = mult === 3 ? 'T' + seg : mult === 2 ? 'D' + seg : String(seg);
    return { score: seg * mult, label, mult, segment: seg };
  }

  function applyDart(remaining, dart) {
    const next = remaining - dart.score;
    if (next < 0 || next === 1) return { remaining, bust: true, dart };
    if (next === 0) {
      if (dart.mult === 2) return { remaining: 0, bust: false, checkout: true, dart };
      return { remaining, bust: true, dart };
    }
    return { remaining: next, bust: false, dart };
  }

  function humanWobble(stats, timingQuality, pressure) {
    const p = profileFromStats(stats);
    const base = 55 - p.accuracy * 40 - p.consistency * 15;
    const timing = (1 - timingQuality) * 35;
    const press = pressure * 20 * (1 - p.experience);
    return Math.max(4, base + timing + press + rand(-3, 3));
  }

  function createMatch(opts) {
    const legsToWin = Math.ceil(opts.bestOf / 2);
    return {
      bestOf: opts.bestOf,
      legsToWin,
      you: { name: opts.youName, remaining: 501, legs: 0, stats: opts.youStats },
      opp: {
        name: opts.oppName,
        remaining: 501,
        legs: 0,
        skill: opts.oppSkill,
        profile: profileFromSkill(opts.oppSkill),
      },
      turn: 'you',
      dartsLeft: 3,
      visitScore: 0,
      visitDarts: [],
      starter: 'you',
      log: [],
      over: false,
      winner: null,
      pressure: 0,
    };
  }

  function updatePressure(m) {
    const legDiff = Math.abs(m.you.legs - m.opp.legs);
    const matchPoint = m.you.legs === m.legsToWin - 1 || m.opp.legs === m.legsToWin - 1 ? 0.25 : 0;
    const close = legDiff === 0 ? 0.15 : 0;
    const finishZone = Math.min(m.you.remaining, m.opp.remaining) <= 100 ? 0.15 : 0;
    m.pressure = clamp(matchPoint + close + finishZone, 0, 0.7);
  }

  return {
    CHECKOUTS,
    preferredTarget,
    profileFromStats,
    profileFromSkill,
    aiThrow,
    applyDart,
    humanWobble,
    createMatch,
    updatePressure,
    makeResult,
  };
})();
