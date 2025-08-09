let shouldShowLoginGlow = false;

export const setLoginGlow = (value: boolean) => {
  shouldShowLoginGlow = value;
};

export const getLoginGlow = () => {
  return shouldShowLoginGlow;
};