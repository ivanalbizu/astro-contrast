import { describe, it, expect } from 'vitest';
import { readTokenFile, readTokenFiles } from '../../src/resolver/token-reader.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const FIXTURES_DIR = join(import.meta.dirname, '../fixtures/tokens');

async function writeFixture(name: string, content: string): Promise<string> {
  await mkdir(FIXTURES_DIR, { recursive: true });
  const filePath = join(FIXTURES_DIR, name);
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

describe('token-reader', () => {
  // --- W3C DTCG format ($value / $type) ---

  describe('DTCG format', () => {
    it('reads flat color tokens', async () => {
      const filePath = await writeFixture('dtcg-flat.json', JSON.stringify({
        primary: {
          $value: '#1a5276',
          $type: 'color',
        },
        secondary: {
          $value: '#2ecc71',
          $type: 'color',
        },
      }));

      const tokens = await readTokenFile(filePath);
      expect(tokens.get('--primary')).toBe('#1a5276');
      expect(tokens.get('--secondary')).toBe('#2ecc71');
      expect(tokens.size).toBe(2);
    });

    it('reads nested color groups', async () => {
      const filePath = await writeFixture('dtcg-nested.json', JSON.stringify({
        color: {
          $type: 'color',
          primary: {
            $value: '#1a5276',
          },
          danger: {
            $value: '#e74c3c',
          },
        },
      }));

      const tokens = await readTokenFile(filePath);
      expect(tokens.get('--color-primary')).toBe('#1a5276');
      expect(tokens.get('--color-danger')).toBe('#e74c3c');
    });

    it('resolves token references (aliases)', async () => {
      const filePath = await writeFixture('dtcg-refs.json', JSON.stringify({
        color: {
          $type: 'color',
          blue: {
            500: { $value: '#3498db' },
          },
        },
        semantic: {
          $type: 'color',
          primary: { $value: '{color.blue.500}' },
        },
      }));

      const tokens = await readTokenFile(filePath);
      expect(tokens.get('--color-blue-500')).toBe('#3498db');
      expect(tokens.get('--semantic-primary')).toBe('#3498db');
    });

    it('handles DTCG color space objects with hex', async () => {
      const filePath = await writeFixture('dtcg-colorspace.json', JSON.stringify({
        brand: {
          $type: 'color',
          primary: {
            $value: {
              colorSpace: 'srgb',
              hex: '#ff6600',
            },
          },
        },
      }));

      const tokens = await readTokenFile(filePath);
      expect(tokens.get('--brand-primary')).toBe('#ff6600');
    });

    it('handles DTCG srgb components without hex', async () => {
      const filePath = await writeFixture('dtcg-components.json', JSON.stringify({
        brand: {
          $type: 'color',
          accent: {
            $value: {
              colorSpace: 'srgb',
              components: [1, 0.4, 0],
            },
          },
        },
      }));

      const tokens = await readTokenFile(filePath);
      // 1*255=255=ff, 0.4*255=102=66, 0*255=0=00
      expect(tokens.get('--brand-accent')).toBe('#ff6600');
    });

    it('skips non-color tokens', async () => {
      const filePath = await writeFixture('dtcg-mixed.json', JSON.stringify({
        primary: {
          $value: '#1a5276',
          $type: 'color',
        },
        spacing: {
          small: {
            $value: '8px',
            $type: 'dimension',
          },
        },
        fontFamily: {
          body: {
            $value: 'Inter',
            $type: 'fontFamily',
          },
        },
      }));

      const tokens = await readTokenFile(filePath);
      expect(tokens.size).toBe(1);
      expect(tokens.get('--primary')).toBe('#1a5276');
    });
  });

  // --- Style Dictionary v3 format (value / type) ---

  describe('Style Dictionary v3 format', () => {
    it('reads SD v3 flat tokens', async () => {
      const filePath = await writeFixture('sd3-flat.json', JSON.stringify({
        color: {
          primary: {
            value: '#1a5276',
            type: 'color',
          },
          secondary: {
            value: 'rgb(46, 204, 113)',
            type: 'color',
          },
        },
      }));

      const tokens = await readTokenFile(filePath);
      expect(tokens.get('--color-primary')).toBe('#1a5276');
      expect(tokens.get('--color-secondary')).toBe('rgb(46, 204, 113)');
    });

    it('resolves SD v3 references', async () => {
      const filePath = await writeFixture('sd3-refs.json', JSON.stringify({
        color: {
          base: {
            blue: {
              value: '#3498db',
              type: 'color',
            },
          },
          semantic: {
            info: {
              value: '{color.base.blue}',
              type: 'color',
            },
          },
        },
      }));

      const tokens = await readTokenFile(filePath);
      expect(tokens.get('--color-base-blue')).toBe('#3498db');
      expect(tokens.get('--color-semantic-info')).toBe('#3498db');
    });
  });

  // --- CSS token files ---

  describe('CSS token files', () => {
    it('reads :root custom properties from CSS', async () => {
      const filePath = await writeFixture('tokens.css', `
        :root {
          --color-primary: #1a5276;
          --color-secondary: #2ecc71;
          --spacing-md: 16px;
        }
      `);

      const tokens = await readTokenFile(filePath);
      expect(tokens.get('--color-primary')).toBe('#1a5276');
      expect(tokens.get('--color-secondary')).toBe('#2ecc71');
      expect(tokens.get('--spacing-md')).toBe('16px');
    });

    it('reads html selector custom properties', async () => {
      const filePath = await writeFixture('tokens-html.css', `
        html {
          --brand-blue: hsl(210, 60%, 30%);
        }
      `);

      const tokens = await readTokenFile(filePath);
      expect(tokens.get('--brand-blue')).toBe('hsl(210, 60%, 30%)');
    });
  });

  // --- YAML token files ---

  describe('YAML token files', () => {
    it('reads DTCG tokens from .yaml', async () => {
      const yaml = `
color:
  $type: color
  primary:
    $value: "#1a5276"
  danger:
    $value: "#e74c3c"
`;
      const filePath = await writeFixture('dtcg.yaml', yaml);
      const tokens = await readTokenFile(filePath);
      expect(tokens.get('--color-primary')).toBe('#1a5276');
      expect(tokens.get('--color-danger')).toBe('#e74c3c');
    });

    it('reads tokens from .yml extension', async () => {
      const yml = `
brand:
  $type: color
  accent:
    $value: "#ff6600"
`;
      const filePath = await writeFixture('brand.yml', yml);
      const tokens = await readTokenFile(filePath);
      expect(tokens.get('--brand-accent')).toBe('#ff6600');
    });

    it('resolves YAML references', async () => {
      const yaml = `
primitives:
  $type: color
  blue500:
    $value: "#3498db"
semantic:
  $type: color
  info:
    $value: "{primitives.blue500}"
`;
      const filePath = await writeFixture('refs.yaml', yaml);
      const tokens = await readTokenFile(filePath);
      expect(tokens.get('--primitives-blue500')).toBe('#3498db');
      expect(tokens.get('--semantic-info')).toBe('#3498db');
    });
  });

  // --- Multiple files ---

  describe('readTokenFiles', () => {
    it('merges tokens from multiple files (later files win)', async () => {
      const file1 = await writeFixture('multi-1.json', JSON.stringify({
        primary: { $value: '#111111', $type: 'color' },
        secondary: { $value: '#222222', $type: 'color' },
      }));

      const file2 = await writeFixture('multi-2.json', JSON.stringify({
        primary: { $value: '#aaaaaa', $type: 'color' },
        tertiary: { $value: '#333333', $type: 'color' },
      }));

      const tokens = await readTokenFiles([file1, file2]);
      expect(tokens.get('--primary')).toBe('#aaaaaa'); // overridden by file2
      expect(tokens.get('--secondary')).toBe('#222222');
      expect(tokens.get('--tertiary')).toBe('#333333');
    });

    it('merges JSON and CSS token files', async () => {
      const jsonFile = await writeFixture('merge.json', JSON.stringify({
        brand: {
          $type: 'color',
          primary: { $value: '#1a5276' },
        },
      }));

      const cssFile = await writeFixture('merge.css', `
        :root {
          --extra-color: #ff0000;
        }
      `);

      const tokens = await readTokenFiles([jsonFile, cssFile]);
      expect(tokens.get('--brand-primary')).toBe('#1a5276');
      expect(tokens.get('--extra-color')).toBe('#ff0000');
    });

    it('returns empty map for empty input', async () => {
      const tokens = await readTokenFiles([]);
      expect(tokens.size).toBe(0);
    });
  });

  // --- Edge cases ---

  describe('edge cases', () => {
    it('handles deeply nested tokens', async () => {
      const filePath = await writeFixture('deep.json', JSON.stringify({
        color: {
          $type: 'color',
          brand: {
            primary: {
              light: { $value: '#e8f4f8' },
              dark: { $value: '#1a5276' },
            },
          },
        },
      }));

      const tokens = await readTokenFile(filePath);
      expect(tokens.get('--color-brand-primary-light')).toBe('#e8f4f8');
      expect(tokens.get('--color-brand-primary-dark')).toBe('#1a5276');
    });

    it('handles chained references', async () => {
      const filePath = await writeFixture('chained.json', JSON.stringify({
        primitives: {
          $type: 'color',
          blue500: { $value: '#3498db' },
        },
        semantic: {
          $type: 'color',
          info: { $value: '{primitives.blue500}' },
        },
        component: {
          $type: 'color',
          banner: { $value: '{semantic.info}' },
        },
      }));

      const tokens = await readTokenFile(filePath);
      expect(tokens.get('--primitives-blue500')).toBe('#3498db');
      expect(tokens.get('--semantic-info')).toBe('#3498db');
      expect(tokens.get('--component-banner')).toBe('#3498db');
    });

    it('handles color-like values without explicit type', async () => {
      const filePath = await writeFixture('no-type.json', JSON.stringify({
        accent: {
          $value: '#ff6600',
        },
      }));

      const tokens = await readTokenFile(filePath);
      expect(tokens.get('--accent')).toBe('#ff6600');
    });
  });
});
