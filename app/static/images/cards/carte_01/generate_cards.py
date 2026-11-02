from pathlib import Path
from html import escape


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

WIDTH = 240
HEIGHT = 336

RANKS = [
    "3", "4", "5", "6", "7",
    "8", "9", "10",
    "J", "Q", "K", "A", "2"
]

SUITS = {
    "clubs": {
        "symbol": "♣",
        "color": "#111827"
    },
    "diamonds": {
        "symbol": "♦",
        "color": "#dc2626"
    },
    "hearts": {
        "symbol": "♥",
        "color": "#dc2626"
    },
    "spades": {
        "symbol": "♠",
        "color": "#111827"
    }
}


# ============================================================
# SVG COMMUN
# ============================================================

def svg_start():
    return f"""<svg
    xmlns="http://www.w3.org/2000/svg"
    width="{WIDTH}"
    height="{HEIGHT}"
    viewBox="0 0 {WIDTH} {HEIGHT}"
>
"""


def card_background():
    return f"""
    <rect
        x="3"
        y="3"
        width="{WIDTH - 6}"
        height="{HEIGHT - 6}"
        rx="18"
        fill="#ffffff"
        stroke="#dbe2ea"
        stroke-width="6"
    />

    <rect
        x="10"
        y="10"
        width="{WIDTH - 20}"
        height="{HEIGHT - 20}"
        rx="14"
        fill="none"
        stroke="#f1f5f9"
        stroke-width="2"
    />
"""


def corner(rank, symbol, color, x, y, rotate=False):

    transform = ""

    if rotate:
        transform = (
            f'transform="rotate(180 {x} {y})"'
        )

    return f"""
    <g {transform}>

        <text
            x="{x}"
            y="{y}"
            text-anchor="middle"
            font-family="Arial, sans-serif"
            font-size="38"
            font-weight="900"
            fill="{color}"
        >
            {escape(rank)}
        </text>

        <text
            x="{x}"
            y="{y + 31}"
            text-anchor="middle"
            font-family="Arial, sans-serif"
            font-size="31"
            fill="{color}"
        >
            {symbol}
        </text>

    </g>
"""


# ============================================================
# CARTE NORMALE
# ============================================================

def generate_card(rank, suit_name, suit):

    symbol = suit["symbol"]
    color = suit["color"]

    svg = svg_start()

    svg += card_background()

    svg += corner(
        rank,
        symbol,
        color,
        31,
        47
    )

    svg += corner(
        rank,
        symbol,
        color,
        WIDTH - 31,
        HEIGHT - 47,
        rotate=True
    )


    # --------------------------------------------------------
    # CENTRE
    # --------------------------------------------------------

    if rank in ["J", "Q", "K"]:

        labels = {
            "J": "J",
            "Q": "Q",
            "K": "K"
        }

        svg += f"""
        <rect
            x="67"
            y="72"
            width="106"
            height="192"
            rx="18"
            fill="#f8fafc"
            stroke="{color}"
            stroke-width="3"
        />

        <circle
            cx="120"
            cy="130"
            r="31"
            fill="{color}"
            opacity="0.12"
        />

        <text
            x="120"
            y="145"
            text-anchor="middle"
            font-family="Georgia, serif"
            font-size="48"
            font-weight="bold"
            fill="{color}"
        >
            {labels[rank]}
        </text>

        <text
            x="120"
            y="213"
            text-anchor="middle"
            font-family="Arial, sans-serif"
            font-size="62"
            fill="{color}"
        >
            {symbol}
        </text>
        """

    else:

        # Pour les cartes numériques / A / 2 :
        # grand symbole central propre.
        font_size = 105

        if rank == "10":
            font_size = 92

        svg += f"""
        <text
            x="120"
            y="196"
            text-anchor="middle"
            dominant-baseline="middle"
            font-family="Arial, sans-serif"
            font-size="{font_size}"
            font-weight="bold"
            fill="{color}"
        >
            {symbol}
        </text>

        <text
            x="120"
            y="269"
            text-anchor="middle"
            font-family="Arial, sans-serif"
            font-size="44"
            font-weight="900"
            fill="{color}"
            opacity="0.16"
        >
            {escape(rank)}
        </text>
        """


    svg += "</svg>"

    filename = (
        f"{rank.lower()}_{suit_name}.svg"
    )

    (BASE_DIR / filename).write_text(
        svg,
        encoding="utf-8"
    )

    print(f"✓ {filename}")


# ============================================================
# JOKER
# ============================================================

def generate_joker(filename, color, accent):

    svg = svg_start()

    svg += card_background()

    svg += f"""
    <defs>

        <linearGradient
            id="jokerGradient"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
        >
            <stop
                offset="0%"
                stop-color="{color}"
            />

            <stop
                offset="100%"
                stop-color="{accent}"
            />
        </linearGradient>

    </defs>


    <text
        x="31"
        y="47"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="25"
        font-weight="900"
        fill="{color}"
    >
        J
    </text>

    <text
        x="31"
        y="76"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="25"
        fill="{color}"
    >
        ★
    </text>


    <circle
        cx="120"
        cy="155"
        r="66"
        fill="url(#jokerGradient)"
        opacity="0.12"
    />


    <text
        x="120"
        y="180"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="90"
        font-weight="900"
        fill="url(#jokerGradient)"
    >
        ★
    </text>


    <text
        x="120"
        y="252"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="29"
        font-weight="900"
        letter-spacing="5"
        fill="{color}"
    >
        JOKER
    </text>


    <g
        transform="rotate(180 209 289)"
    >

        <text
            x="209"
            y="289"
            text-anchor="middle"
            font-family="Arial, sans-serif"
            font-size="25"
            font-weight="900"
            fill="{color}"
        >
            J
        </text>

        <text
            x="209"
            y="318"
            text-anchor="middle"
            font-family="Arial, sans-serif"
            font-size="25"
            fill="{color}"
        >
            ★
        </text>

    </g>

    </svg>
    """

    (BASE_DIR / filename).write_text(
        svg,
        encoding="utf-8"
    )

    print(f"✓ {filename}")


# ============================================================
# DOS DE CARTE
# ============================================================

def generate_back():

    svg = f"""<svg
    xmlns="http://www.w3.org/2000/svg"
    width="{WIDTH}"
    height="{HEIGHT}"
    viewBox="0 0 {WIDTH} {HEIGHT}"
>

    <defs>

        <linearGradient
            id="background"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
        >

            <stop
                offset="0%"
                stop-color="#312e81"
            />

            <stop
                offset="50%"
                stop-color="#6d28d9"
            />

            <stop
                offset="100%"
                stop-color="#1d4ed8"
            />

        </linearGradient>


        <pattern
            id="pattern"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
        >

            <path
                d="
                    M14 2
                    L26 14
                    L14 26
                    L2 14
                    Z
                "
                fill="none"
                stroke="#ffffff"
                stroke-opacity="0.12"
                stroke-width="2"
            />

        </pattern>


        <filter id="glow">

            <feGaussianBlur
                stdDeviation="4"
                result="blur"
            />

            <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>

        </filter>

    </defs>


    <rect
        x="3"
        y="3"
        width="{WIDTH - 6}"
        height="{HEIGHT - 6}"
        rx="18"
        fill="#090f20"
        stroke="#dbeafe"
        stroke-width="6"
    />


    <rect
        x="11"
        y="11"
        width="{WIDTH - 22}"
        height="{HEIGHT - 22}"
        rx="13"
        fill="url(#background)"
    />


    <rect
        x="11"
        y="11"
        width="{WIDTH - 22}"
        height="{HEIGHT - 22}"
        rx="13"
        fill="url(#pattern)"
    />


    <rect
        x="24"
        y="24"
        width="{WIDTH - 48}"
        height="{HEIGHT - 48}"
        rx="12"
        fill="none"
        stroke="#c4b5fd"
        stroke-width="3"
    />


    <path
        d="
            M120 78
            L174 168
            L120 258
            L66 168
            Z
        "
        fill="#090f20"
        fill-opacity="0.45"
        stroke="#c4b5fd"
        stroke-width="4"
        filter="url(#glow)"
    />


    <path
        d="
            M120 112
            L153 168
            L120 224
            L87 168
            Z
        "
        fill="none"
        stroke="#ffffff"
        stroke-opacity="0.65"
        stroke-width="3"
    />


    <text
        x="120"
        y="190"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="70"
        fill="#ffffff"
        filter="url(#glow)"
    >
        ♠
    </text>

</svg>
"""

    filename = "back.svg"

    (BASE_DIR / filename).write_text(
        svg,
        encoding="utf-8"
    )

    print(f"✓ {filename}")


# ============================================================
# GÉNÉRATION
# ============================================================

print()
print("Génération du deck Président...")
print()


for suit_name, suit in SUITS.items():

    for rank in RANKS:

        generate_card(
            rank,
            suit_name,
            suit
        )


generate_joker(
    "joker_red.svg",
    "#dc2626",
    "#f97316"
)

generate_joker(
    "joker_black.svg",
    "#111827",
    "#6d28d9"
)

generate_back()


print()
print("==============================")
print("Deck terminé")
print("52 cartes")
print("2 jokers")
print("1 dos de carte")
print("55 fichiers SVG au total")
print("==============================")