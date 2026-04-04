from transformers import BertTokenizer, BertModel
import torch
import re

# Load BERT once
tokenizer = BertTokenizer.from_pretrained("bert-large-uncased")
model = BertModel.from_pretrained("bert-large-uncased")
model.eval()

FACIAL_KEYWORDS = {

# =====================================================
# HAIR (EXTREMELY EXPANDED)
# =====================================================
"hair": [
    "hair", "head hair", "hair on head", "hairstyle", "hair style",
    "no hair", "without hair",
    "bald", "bald head", "balding", "losing hair",
    "partially bald", "half bald", "bald on top", "thin hair on top",
    "completely bald", "fully bald",
    "short hair", "very short hair", "extremely short hair",
    "buzz cut", "crew cut", "army cut", "military cut",
    "medium hair", "medium length hair", "neck length hair",
    "shoulder length hair", "touching shoulders",
    "long hair", "very long hair", "extremely long hair",
    "waist length hair", "below shoulders",
    "curly hair", "tight curls", "loose curls", "soft curls",
    "coily hair", "kinky hair",
    "straight hair", "pin straight hair",
    "wavy hair", "slightly wavy hair",
    "frizzy hair", "rough hair",
    "spiky hair", "standing hair",
    "messy hair", "untidy hair", "uncombed hair",
    "neatly combed", "well combed", "slicked back",
    "oily hair", "greasy hair", "dry hair",
    "thin hair", "thick hair", "dense hair",
    "black hair", "jet black hair",
    "dark hair", "dark brown hair",
    "brown hair", "light brown hair",
    "auburn hair",
    "blonde hair", "golden hair", "platinum blonde",
    "red hair", "ginger hair",
    "grey hair", "gray hair", "white hair", "silver hair",
    "salt and pepper hair",
    "dyed hair", "colored hair", "artificial hair color",
    "highlighted hair", "streaked hair",
    "receding hairline", "hair going back",
    "widow's peak", "v-shaped hairline",
    "high forehead", "low hairline",
    "side part", "middle part", "center part",
    "no part", "natural part",
    "ponytail", "low ponytail", "high ponytail",
    "man bun", "bun", "top knot",
    "braids", "braided hair", "cornrows",
    "afro", "big afro", "small afro",
    "dreadlocks", "locs", "twists",
    "pigtails", "bob cut", "pixie cut",
    "hair tied", "hair open"
],

# =====================================================
# EYES (EXTREMELY EXPANDED)
# =====================================================
"eyes": [
    "eye", "eyes", "both eyes",
    "big eyes", "large eyes", "very big eyes", "huge eyes",
    "small eyes", "tiny eyes", "very small eyes",
    "round eyes", "perfectly round eyes",
    "oval eyes",
    "almond eyes", "almond shaped eyes",
    "hooded eyes",
    "upturned eyes", "eyes tilted up",
    "downturned eyes", "eyes tilted down",
    "monolid eyes", "single eyelid",
    "wide set eyes", "eyes far apart",
    "close set eyes", "eyes close together",
    "deep set eyes",
    "droopy eyes", "drooping eyelids",
    "saggy eyelids",
    "sleepy eyes", "tired eyes",
    "sunken eyes",
    "bulging eyes", "protruding eyes",
    "sharp eyes", "piercing eyes", "intense eyes",
    "black eyes", "dark eyes",
    "brown eyes", "dark brown eyes",
    "light brown eyes",
    "blue eyes", "light blue eyes",
    "green eyes",
    "hazel eyes",
    "grey eyes", "gray eyes",
    "amber eyes",
    "different colored eyes", "heterochromia",
    "watery eyes", "teary eyes",
    "red eyes", "bloodshot eyes",
    "blind in one eye", "one blind eye",
    "squinting eyes", "squint eyes",
    "cross eyed",
    "long eyelashes", "thick eyelashes",
    "short eyelashes", "sparse lashes",
    "dark circles", "eye bags",
    "bags under eyes", "puffy eyes"
],

# =====================================================
# EYEBROWS (EXTREMELY EXPANDED)
# =====================================================
"eyebrows": [
    "eyebrow", "eyebrows", "brows",
    "thick eyebrows", "very thick eyebrows",
    "thin eyebrows", "very thin eyebrows",
    "sparse eyebrows", "light eyebrows",
    "bushy eyebrows", "heavy eyebrows",
    "dense eyebrows",
    "arched eyebrows", "high arch eyebrows",
    "low arch", "soft arch",
    "straight eyebrows", "flat eyebrows",
    "angled eyebrows", "sharp eyebrows",
    "uneven eyebrows", "asymmetric eyebrows",
    "unibrow", "joined eyebrows", "monobrow",
    "short eyebrows", "long eyebrows",
    "overgrown brows",
    "plucked eyebrows",
    "tattooed eyebrows",
    "microbladed eyebrows",
    "scar on eyebrow", "cut on eyebrow"
],

# =====================================================
# FOREHEAD
# =====================================================
"forehead": [
    "forehead",
    "big forehead", "large forehead",
    "high forehead",
    "low forehead",
    "broad forehead", "wide forehead",
    "narrow forehead",
    "wrinkled forehead",
    "smooth forehead",
    "prominent forehead",
    "flat forehead"
],

# =====================================================
# CHEEKS & CHEEKBONES
# =====================================================
"cheeks": [
    "cheek", "cheeks",
    "chubby cheeks", "fat cheeks",
    "plump cheeks",
    "sunken cheeks",
    "hollow cheeks",
    "full cheeks",
    "rosy cheeks",
    "cheek dimple", "dimples",
    "cheekbone", "cheekbones",
    "high cheekbones",
    "low cheekbones",
    "sharp cheekbones",
    "prominent cheekbones",
    "chiseled cheeks"
],

# =====================================================
# NOSE (EXTREMELY EXPANDED)
# =====================================================
"nose": [
    "nose",
    "big nose", "large nose", "huge nose",
    "small nose", "tiny nose",
    "long nose", "short nose",
    "flat nose",
    "broad nose", "wide nose",
    "narrow nose",
    "sharp nose", "pointed nose",
    "button nose",
    "roman nose", "greek nose",
    "hooked nose", "hawk nose",
    "aquiline nose",
    "crooked nose", "bent nose",
    "broken nose", "injured nose",
    "bulbous nose",
    "upturned nose",
    "nose piercing", "nose ring",
    "septum piercing"
],

# =====================================================
# MOUTH & LIPS
# =====================================================
"mouth": [
    "mouth", "lips",
    "big mouth", "wide mouth",
    "small mouth", "tiny mouth",
    "thin lips", "very thin lips",
    "thick lips", "full lips",
    "plump lips", "pouty lips",
    "medium lips",
    "dry lips", "chapped lips",
    "cracked lips",
    "smiling mouth", "always smiling",
    "sad mouth", "downturned mouth",
    "crooked mouth",
    "open mouth",
    "gap between lips"
],

# =====================================================
# TEETH
# =====================================================
"teeth": [
    "teeth", "smile",
    "white teeth", "bright teeth",
    "yellow teeth", "stained teeth",
    "crooked teeth", "misaligned teeth",
    "gap teeth", "gap between teeth",
    "missing teeth",
    "broken teeth", "chipped tooth",
    "visible teeth",
    "gummy smile",
    "gold tooth", "metal tooth",
    "braces"
],

# =====================================================
# JAW & CHIN
# =====================================================
"jaw_chin": [
    "jaw", "jawline", "chin",
    "strong jaw", "sharp jawline",
    "defined jawline",
    "weak jaw",
    "square jaw",
    "round jaw",
    "double chin",
    "pointed chin",
    "round chin",
    "cleft chin",
    "receding chin"
],

# =====================================================
# FACIAL HAIR
# =====================================================
"facial_hair": [
    "beard", "full beard", "thick beard",
    "thin beard", "patchy beard",
    "long beard", "short beard",
    "moustache", "mustache",
    "thick moustache", "thin moustache",
    "handlebar mustache",
    "goatee", "french beard",
    "soul patch",
    "sideburns", "long sideburns",
    "stubble", "light stubble",
    "heavy stubble",
    "five o'clock shadow",
    "clean shaven", "no beard"
],

# =====================================================
# SKIN TONE & TEXTURE
# =====================================================
"skin": [
    "skin", "complexion",
    "very fair", "fair", "light skin",
    "wheatish", "medium skin",
    "brown skin", "dark brown skin",
    "dark skin", "very dark skin",
    "oily skin", "dry skin",
    "rough skin", "smooth skin",
    "wrinkled skin", "aged skin",
    "acne", "acne scars",
    "freckles", "spots"
],

# =====================================================
# MARKS, SCARS & IDENTIFIERS
# =====================================================
"marks": [
    "scar", "old scar", "fresh scar",
    "cut mark", "injury mark",
    "mole", "beauty mark",
    "birthmark",
    "tattoo", "face tattoo",
    "burn mark",
    "wrinkles", "deep wrinkles",
    "freckles",
    "dimple"
],

# =====================================================
# EXPRESSIONS
# =====================================================
"expression": [
    "angry", "very angry", "furious",
    "serious", "stern",
    "calm", "neutral",
    "smiling", "laughing",
    "sad", "depressed",
    "nervous", "anxious",
    "aggressive", "threatening",
    "confident", "bold",
    "confused", "surprised",
    "blank expression"
],

# =====================================================
# AGE & APPEARANCE
# =====================================================
"age": [
    "baby", "child", "kid",
    "teenager",
    "young", "young adult",
    "middle aged",
    "old", "elderly",
    "appears young", "appears old"
]
}
def extract_features(text):
    text = text.lower()

    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True)
    with torch.no_grad():
        _ = model(**inputs)

    extracted = {}

    for feature, keywords in FACIAL_KEYWORDS.items():
        for word in keywords:
            if re.search(r"\b" + word + r"\b", text):
                extracted[feature] = word

    if not extracted:
        extracted["info"] = "No clear facial features detected"

    return extracted