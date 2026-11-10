declare module "qrcode" {
  const qrcode: {
    toString(
      text: string,
      options: { type: "svg"; margin?: number; width?: number },
    ): Promise<string>;
  };

  export default qrcode;
}
