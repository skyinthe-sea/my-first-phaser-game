// 아이템 데이터베이스
export const ITEMS = {
  combo_shield: {
    id: 'combo_shield',
    name: 'Combo Shield',
    description: 'Protects your combo once when you would lose it',
    price: 100,
    rarity: 'rare',
    icon: 'combo_shield', // 이미지 키
    effect: {
      type: 'trigger',
      trigger: 'combo_fail',
      uses: 1
    },
    visual: {
      // 뱀 외형 변화 없음
    }
  },

  // 깡통 아이템들 (추후 구현)
  speed_boost: {
    id: 'speed_boost',
    name: 'Speed Boost',
    description: 'Increases movement speed by 10%',
    price: 150,
    rarity: 'common',
    icon: null, // 이미지 없음
    effect: {
      type: 'stat',
      stat: 'speed',
      value: 0.1
    },
    visual: {
      headColor: 0xffff00
    }
  },

  score_double: {
    id: 'score_double',
    name: 'Score x2',
    description: 'Doubles your score for the next stage',
    price: 200,
    rarity: 'common',
    icon: null,
    effect: {
      type: 'stat',
      stat: 'scoreMultiplier',
      value: 2
    },
    visual: {}
  },

  extra_life: {
    id: 'extra_life',
    name: 'Extra Life',
    description: 'Revive once when you die',
    price: 300,
    rarity: 'epic',
    icon: null,
    effect: {
      type: 'trigger',
      trigger: 'death',
      uses: 1
    },
    visual: {}
  },

  magnet: {
    id: 'magnet',
    name: 'Magnet',
    description: 'Attracts nearby food',
    price: 250,
    rarity: 'rare',
    icon: null,
    effect: {
      type: 'passive',
      range: 3
    },
    visual: {}
  }
};

// 상점에 표시할 아이템 순서
export const SHOP_ITEMS = [
  'combo_shield',
  'speed_boost',
  'score_double',
  'extra_life',
  'magnet'
];

// 아이템 ID로 데이터 가져오기
export function getItem(id) {
  return ITEMS[id] || null;
}

// 상점 아이템 목록 가져오기
export function getShopItems() {
  return SHOP_ITEMS.map(id => ({
    ...ITEMS[id],
    purchased: false
  }));
}
