import {Text, TextInput} from 'react-native';

type TextDefaultsTarget = typeof Text & {
  defaultProps?: {
    style?: unknown;
  };
};

type TextInputDefaultsTarget = typeof TextInput & {
  defaultProps?: {
    style?: unknown;
  };
};

export function applyPoppinsDefaults(): void {
  const textTarget = Text as TextDefaultsTarget;
  const inputTarget = TextInput as TextInputDefaultsTarget;

  textTarget.defaultProps = textTarget.defaultProps ?? {};
  textTarget.defaultProps.style = [
    textTarget.defaultProps.style,
    {fontFamily: 'Poppins-Regular'},
  ];

  inputTarget.defaultProps = inputTarget.defaultProps ?? {};
  inputTarget.defaultProps.style = [
    inputTarget.defaultProps.style,
    {fontFamily: 'Poppins-Regular'},
  ];
}
