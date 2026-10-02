// @ts-check
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import pluginSecurity from 'eslint-plugin-security';

export default tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
      pluginSecurity.configs.recommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      // Advertencia para outputs legítimos como cancel/close en ventanas modales
      '@angular-eslint/no-output-native': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Evita falsos positivos en TypeScript al acceder a diccionarios y propiedades indexadas
      'security/detect-object-injection': 'off',
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      // En pruebas unitarias es habitual usar mocks con tipos flexibles
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      // Advertencia para clicks de cierre en overlays y fondos (backdrops)
      '@angular-eslint/template/click-events-have-key-events': 'warn',
      '@angular-eslint/template/interactive-supports-focus': 'warn',
    },
  }
);
