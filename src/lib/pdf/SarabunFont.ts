import { Font } from '@react-pdf/renderer';

export const registerSarabunFont = () => {
  Font.register({
    family: 'Sarabun',
    fonts: [
      { src: '/fonts/Sarabun-Regular.ttf', fontWeight: 'normal' },
      { src: '/fonts/Sarabun-Bold.ttf', fontWeight: 'bold' }
    ]
  });
};
