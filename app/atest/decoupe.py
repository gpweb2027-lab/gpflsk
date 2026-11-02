import cv2
import os

# Charger l'image
image = cv2.imread("avatars.png")

clone = image.copy()

compteur = 1
x1, y1 = -1, -1
selection_en_cours = False

# Dossier de sortie
os.makedirs("avatars", exist_ok=True)

def souris(event, x, y, flags, param):
    global x1, y1, selection_en_cours, image

    if event == cv2.EVENT_LBUTTONDOWN:
        x1, y1 = x, y
        selection_en_cours = True

    elif event == cv2.EVENT_MOUSEMOVE and selection_en_cours:
        image = clone.copy()
        cv2.rectangle(image, (x1, y1), (x, y), (0, 255, 0), 2)

    elif event == cv2.EVENT_LBUTTONUP:
        selection_en_cours = False

        x_min = min(x1, x)
        x_max = max(x1, x)
        y_min = min(y1, y)
        y_max = max(y1, y)

        image = clone.copy()
        cv2.rectangle(image, (x_min, y_min), (x_max, y_max), (0, 255, 0), 2)

        param["selection"] = (x_min, y_min, x_max, y_max)

donnees = {"selection": None}

cv2.namedWindow("Avatar")
cv2.setMouseCallback("Avatar", souris, donnees)

while True:

    cv2.imshow("Avatar", image)

    touche = cv2.waitKey(1) & 0xFF

    # Touche S = sauvegarder
    if touche == ord("s"):

        if donnees["selection"]:

            x_min, y_min, x_max, y_max = donnees["selection"]

            avatar = clone[y_min:y_max, x_min:x_max]

            nom = f"avatars/avatar{compteur}.png"

            cv2.imwrite(nom, avatar)

            print(f"Sauvegardé : {nom}")

            compteur += 1

    # Echap
    elif touche == 27:
        break

cv2.destroyAllWindows()