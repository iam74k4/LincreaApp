import { Platform } from 'react-native';

import { mimeFor } from '../platform/files';

jest.mock('expo-file-system', () => ({ Directory: class {}, File: class {}, Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

describe('mimeFor: 中身の種類を、名前の拡張子で補う（Android だけ）', () => {
  afterEach(() => {
    Platform.OS = 'ios';
  });

  it('ページが種類を言ったら、そのまま使う', () => {
    Platform.OS = 'android';
    expect(mimeFor('明細.pdf', 'application/pdf')).toBe('application/pdf');
    expect(mimeFor('x.pdf', 'text/plain')).toBe('text/plain');
  });

  it('Android: 種類が octet-stream（何でもあり）や空なら、拡張子から決める（開くアプリを探すのに要る）', () => {
    Platform.OS = 'android';
    expect(mimeFor('給与明細_20261116_1240.pdf', 'application/octet-stream')).toBe('application/pdf');
    expect(mimeFor('実績.XLSX', '')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(mimeFor('実績.xls', 'application/octet-stream')).toBe('application/vnd.ms-excel');
    expect(mimeFor('一覧.csv', 'application/octet-stream')).toBe('text/csv');
  });

  it('Android: 拡張子も知らないものは octet-stream のまま（空なら octet-stream にする）。object の継承の名前も引かない', () => {
    Platform.OS = 'android';
    expect(mimeFor('data.bin', 'application/octet-stream')).toBe('application/octet-stream');
    expect(mimeFor('data', '')).toBe('application/octet-stream');
    expect(mimeFor('x.constructor', 'application/octet-stream')).toBe('application/octet-stream');
    expect(mimeFor('x.toString', '')).toBe('application/octet-stream');
  });

  it('iPhone: 補わない（種類をそのまま渡す。Quick Look は拡張子で見分ける）', () => {
    Platform.OS = 'ios';
    expect(mimeFor('実績.XLSX', 'application/octet-stream')).toBe('application/octet-stream');
    expect(mimeFor('明細.pdf', '')).toBe('');
  });
});
