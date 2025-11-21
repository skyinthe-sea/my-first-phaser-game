// 은행 데이터 - 대출 시스템용
// 각 티어별로 금리와 한도가 다름

export const bankData = {
  // 1차 대출 - 일반 은행들 (좋은 조건)
  tier1: [
    {
      id: 'national_bank',
      name: 'National Bank',
      interestRate: { min: 3, max: 5 },      // 3~5%
      maxLoan: { min: 800, max: 1000 }       // $800~1000
    },
    {
      id: 'city_bank',
      name: 'City Bank',
      interestRate: { min: 4, max: 6 },
      maxLoan: { min: 700, max: 900 }
    },
    {
      id: 'trust_bank',
      name: 'Trust Bank',
      interestRate: { min: 3, max: 7 },
      maxLoan: { min: 600, max: 1000 }
    },
    {
      id: 'central_bank',
      name: 'Central Bank',
      interestRate: { min: 5, max: 8 },
      maxLoan: { min: 500, max: 800 }
    },
    {
      id: 'union_bank',
      name: 'Union Bank',
      interestRate: { min: 4, max: 7 },
      maxLoan: { min: 600, max: 850 }
    }
  ],

  // 2차 대출 - 저축은행들 (중간 조건)
  tier2: [
    {
      id: 'savings_plus',
      name: 'Savings Plus',
      interestRate: { min: 8, max: 12 },
      maxLoan: { min: 400, max: 600 }
    },
    {
      id: 'quick_loan',
      name: 'Quick Loan',
      interestRate: { min: 10, max: 15 },
      maxLoan: { min: 300, max: 500 }
    },
    {
      id: 'easy_credit',
      name: 'Easy Credit',
      interestRate: { min: 9, max: 14 },
      maxLoan: { min: 350, max: 550 }
    }
  ],

  // 3차 대출 - 대부업체 (높은 금리)
  tier3: [
    {
      id: 'fast_cash',
      name: 'Fast Cash',
      interestRate: { min: 18, max: 24 },    // 법정최고금리 근처
      maxLoan: { min: 100, max: 300 }
    },
    {
      id: 'emergency_loan',
      name: 'Emergency Loan',
      interestRate: { min: 20, max: 24 },
      maxLoan: { min: 100, max: 250 }
    }
  ],

  // 검색 애니메이션 설정
  searchAnimation: {
    tier1: { minDelay: 1000, maxDelay: 1500 },   // 1~1.5초
    tier2: { minDelay: 2000, maxDelay: 3000 },   // 2~3초
    tier3: { minDelay: 3000, maxDelay: 5000 },   // 3~5초
    noBank: { minDelay: 4000, maxDelay: 6000 }   // 4~6초 (찾다가 없음)
  },

  // 검색 메시지
  searchMessages: [
    'Searching for available banks...',
    'Checking your credit score...',
    'Reviewing loan options...',
    'Contacting financial institutions...',
    'Analyzing interest rates...'
  ],

  // 대출 불가 메시지
  noLoanMessages: [
    'No banks available for lending.',
    'Your credit limit has been reached.',
    'Please repay existing loans first.'
  ]
};

// 랜덤 값 생성 헬퍼 함수
export function getRandomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 은행 데이터에서 랜덤 값으로 실제 은행 정보 생성
export function generateBankOffer(bankTemplate) {
  return {
    id: bankTemplate.id,
    name: bankTemplate.name,
    interestRate: getRandomInRange(bankTemplate.interestRate.min, bankTemplate.interestRate.max),
    maxLoan: getRandomInRange(bankTemplate.maxLoan.min, bankTemplate.maxLoan.max)
  };
}

// 티어별 은행 목록 생성 (랜덤 값 적용)
export function generateBankList(tier) {
  const tierData = bankData[tier];
  if (!tierData) return [];

  return tierData.map(bank => generateBankOffer(bank));
}
