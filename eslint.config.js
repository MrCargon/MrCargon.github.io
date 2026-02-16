import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser environment
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        getComputedStyle: 'readonly',
        CustomEvent: 'readonly',
        AbortController: 'readonly',
        module: 'readonly',
        fetch: 'readonly',
        performance: 'readonly',
        HTMLElement: 'readonly',
        Stats: 'readonly',
        process: 'readonly',

        // THREE.js and project globals
        THREE: 'readonly',
        Planet: 'readonly',
        OrbitalCalculator: 'readonly',
        ProjectFiltersManager: 'readonly',
        MemoryManager: 'readonly',
        ResourceLoader: 'readonly',

        // Solar system classes
        Sun: 'readonly',
        Mercury: 'readonly',
        Venus: 'readonly',
        Earth: 'readonly',
        Mars: 'readonly',
        Jupiter: 'readonly',
        Saturn: 'readonly',
        Uranus: 'readonly',
        Neptune: 'readonly',
        DwarfPlanet: 'readonly',
        AsteroidBelt: 'readonly',
        KuiperBelt: 'readonly',
        CosmicDust: 'readonly',

        // Physics visualizations
        VibratingString: 'readonly',
        ExtraDimensionsViz: 'readonly',
      },
    },
    rules: {
      // Power of Ten Rule Enforcement

      // Rule 1: Simple Control Flow
      'no-restricted-syntax': [
        'error',
        {
          selector: 'WithStatement',
          message: 'With statements are not allowed (Rule 1)',
        },
        {
          selector: 'LabeledStatement',
          message: 'Labeled statements (goto-like) are not allowed (Rule 1)',
        },
        {
          selector: 'CallExpression[callee.name=\'eval\']',
          message: 'eval() is not allowed (Rule 1)',
        },
      ],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-with': 'error',
      'no-labels': 'error',

      // Rule 2: Bounded Loops
      'no-unreachable-loop': 'error',
      'no-constant-condition': ['error', { checkLoops: true }],

      // Rule 4: Function Length
      'max-lines-per-function': [
        'error',
        {
          max: 60,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'max-statements': ['error', 50],
      'max-params': ['error', 6],

      // Rule 1: Nesting Depth
      'max-depth': ['error', 4],
      'complexity': ['error', 15],

      // Rule 7: Check Returns
      'consistent-return': 'error',
      'no-unused-vars': ['error', { args: 'all', varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],

      // Rule 10: Compiler Warnings
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-unused-expressions': 'error',
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-shadow': 'error',
      'no-shadow-restricted-names': 'error',

      // Additional Safety Rules
      'strict': ['error', 'global'],
      'eqeqeq': ['error', 'always'],
      'no-implicit-globals': 'error',
      'no-implicit-coercion': 'error',
      'no-mixed-operators': 'error',
      'no-multi-spaces': 'error',
      'no-multiple-empty-lines': ['error', { max: 2 }],
      'no-nested-ternary': 'error',
      'no-new': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-param-reassign': 'error',
      'no-return-assign': 'error',
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-throw-literal': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unused-private-class-members': 'error',
      'no-use-before-define': 'error',
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'radix': 'error',
      'require-await': 'error',
      'yoda': 'error',
    },
  },
  {
    files: ['src/**/*.js'],
    rules: {
      'no-console': 'off', // Allow console statements in source files
    },
  },
];
