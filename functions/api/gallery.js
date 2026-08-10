// Face gallery for the portfolio demo.
// Each entry has a name, a description of the person's appearance (used for
// text-embedding matching), and an image URL.
// The matching endpoint (/api/match-face) compares a text description against
// these descriptions using Workers AI text embeddings + cosine similarity.
export default [
  {
    label: "Nithin CS",
    description: "A man with short black hair, oval face, thin mustache, brown eyes, medium skin tone, in his late 20s to early 30s, clean-shaven except for mustache, straight nose, normal lip thickness.",
    image_url: "",
  },
  {
    label: "Hari",
    description: "A man with short dark hair, round face, thick eyebrows, wide eyes, medium skin tone, in his late 20s, stubble beard, broad nose, medium lips.",
    image_url: "",
  },
  {
    label: "John Doe",
    description: "A man with short brown hair, square jaw, high cheekbones, light skin tone, thin lips, narrow eyes, sharp nose, in his mid 30s, clean-shaven, short forehead.",
    image_url: "",
  },
];