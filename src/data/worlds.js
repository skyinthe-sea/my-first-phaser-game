// World Configuration for Snake Game
// Each world has 3 stages, with the last stage being a boss stage

export const WORLD_CONFIG = {
  world0: {
    name: 'Basic',
    nameKo: '기본',
    range: [1, 3],
    bossStage: 3,
    bossType: 'poison_frog',
    features: {
      crosshairFlash: true,  // 1-5번째 먹이 위치 강조
      teleport: true         // 16-19번째 먹이 텔레포트
    }
  },
  world1: {
    name: 'Deadzone',
    nameKo: '데드존',
    range: [4, 6],
    bossStage: 6,
    bossType: 'bullet_hell',
    features: {
      deadzones: true,       // 데드존 생성
      shop: true             // 상점 해금 (Stage 3 클리어 후)
    }
  },
  world2: {
    name: 'Darkness',
    nameKo: '다크니스',
    range: [7, 9],
    bossStage: 9,
    bossType: 'nocturne',
    features: {
      fog: true,             // 안개 (Fog of War)
      loan: true             // 대출 기능 (Stage 8 클리어 후)
    }
  },
  world3: {
    name: 'Machine Kingdom',
    nameKo: '기계왕국',
    range: [10, 12],
    bossStage: 12,
    bossType: null,          // TBD
    features: {
      saws: true             // 움직이는 톱니
    }
  },
  world4: {
    name: 'Cyber World',
    nameKo: '사이버월드',
    range: [13, 15],
    bossStage: 15,
    bossType: null,          // TBD
    features: {
      gasZone: true          // 독가스 자기장
    }
  }
};

// Test stages for new world development (현재: 기계왕국 개발 중)
// -2 = Stage 10, -1 = Stage 11, 0 = Stage 12 (보스)
export const TEST_STAGES = {
  '-2': {
    name: 'Test Stage -2',
    isTest: true,
    worldName: 'Machine Kingdom',
    mappedStage: 10,
    features: { saws: true }
  },
  '-1': {
    name: 'Test Stage -1',
    isTest: true,
    worldName: 'Machine Kingdom',
    mappedStage: 11,
    features: { saws: true, enhancedSaws: true }
  },
  '0': {
    name: 'Test Stage 0',
    isTest: true,
    isBoss: true,
    worldName: 'Machine Kingdom',
    mappedStage: 12,
    bossType: 'gear_titan'
  }
};

/**
 * Get the equivalent real stage for a test stage
 * @param {number} stage - Stage number (can be negative for test stages)
 * @returns {number} The mapped real stage number
 */
export function getEffectiveStage(stage) {
  if (stage <= 0) {
    const testStage = TEST_STAGES[stage.toString()];
    return testStage ? testStage.mappedStage : 10; // 기본값: Stage 10
  }
  return stage;
}

/**
 * Get world configuration by stage number
 * @param {number} stage - Stage number (can be negative for test stages)
 * @returns {object} World configuration object
 */
export function getWorldByStage(stage) {
  // Test stages - 기계왕국 개발 중
  if (stage <= 0) {
    return {
      worldId: 'test',
      name: 'Machine Kingdom (Dev)',
      nameKo: '기계왕국 (개발)',
      range: [-2, 0],
      bossStage: 0,
      bossType: 'gear_titan',
      isTest: true,
      features: {
        saws: true,
        enhancedSaws: stage === -1
      }
    };
  }

  // Find matching world
  for (const [worldId, config] of Object.entries(WORLD_CONFIG)) {
    const [min, max] = config.range;
    if (stage >= min && stage <= max) {
      return { worldId, ...config };
    }
  }

  // For stages beyond defined worlds (16+), calculate dynamically
  const worldIndex = Math.floor((stage - 1) / 3);
  return {
    worldId: `world${worldIndex}`,
    name: `World ${worldIndex}`,
    nameKo: `월드 ${worldIndex}`,
    range: [worldIndex * 3 + 1, (worldIndex + 1) * 3],
    bossStage: (worldIndex + 1) * 3,
    bossType: null
  };
}

/**
 * Check if a stage is a boss stage
 * @param {number} stage - Stage number
 * @returns {object|null} Boss info or null if not a boss stage
 */
export function getBossInfoForStage(stage) {
  // Test boss stage
  if (stage === 0) {
    return { type: null, isTestBoss: true };
  }

  // Check defined worlds
  for (const config of Object.values(WORLD_CONFIG)) {
    if (config.bossStage === stage) {
      return {
        type: config.bossType,
        worldName: config.name
      };
    }
  }

  // For stages beyond defined worlds, boss every 3 stages
  if (stage > 15 && stage % 3 === 0) {
    return { type: null, worldName: `World ${Math.floor((stage - 1) / 3)}` };
  }

  return null;
}

/**
 * Get active features for a stage
 * @param {number} stage - Stage number
 * @returns {object} Active features
 */
export function getStageFeatures(stage) {
  if (stage <= 0) {
    // 테스트 스테이지 - 기계왕국 기능 활성화
    return { isTest: true, saws: true };
  }

  const world = getWorldByStage(stage);
  return world.features || {};
}

/**
 * Check if saws should be active for a stage
 * @param {number} stage - Stage number
 * @returns {boolean}
 */
export function shouldHaveSaws(stage) {
  const effective = getEffectiveStage(stage);
  return effective >= 10 && effective <= 12;
}

/**
 * Check if gas zone should be active for a stage
 * @param {number} stage - Stage number
 * @returns {boolean}
 */
export function shouldHaveGasZone(stage) {
  return stage >= 13 && stage <= 15;
}

/**
 * Check if fog should be active for a stage
 * @param {number} stage - Stage number
 * @returns {boolean}
 */
export function shouldHaveFog(stage) {
  return stage >= 7 && stage <= 9;
}

/**
 * Check if deadzones should spawn for a stage
 * @param {number} stage - Stage number
 * @returns {boolean}
 */
export function shouldHaveDeadzones(stage) {
  return stage >= 4;
}
