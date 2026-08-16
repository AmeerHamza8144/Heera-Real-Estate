const propertyPage = {
  id: Number(new URLSearchParams(window.location.search).get("id") || new URLSearchParams(window.location.search).get("property_id")),
  images: [],
  currentImage: 0
};

const element = (id) => document.getElementById(id);

function safeMediaUrl(value) {
  const url = String(value || "").trim();
  if (/^uploads\/[A-Za-z0-9_-]+\.(?:jpe?g|png|gif|webp|mp4|webm)$/i.test(url)) return url;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function formatNumber(value, maximumFractionDigits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits }).format(number);
}

function formatUsd(value, listingType) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(number);
  return listingType === "rent" ? `${price} / month` : price;
}

function formatPkr(value, listingType) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  const price = `PKR ${formatNumber(number)}`;
  return listingType === "rent" ? `${price} / month` : price;
}

function labelValue(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function propertyAddress(property) {
  return [property.address_line1, property.city, property.state_region, property.postal_code]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");
}

function addFact(container, label, value) {
  if (value === null || value === undefined || String(value).trim() === "") return;
  const fact = document.createElement("div");
  fact.className = "property-fact";
  const factLabel = document.createElement("span");
  const factValue = document.createElement("strong");
  factLabel.textContent = label;
  factValue.textContent = String(value);
  fact.append(factLabel, factValue);
  container.append(fact);
}

function showImage(index) {
  if (!propertyPage.images.length) return;
  propertyPage.currentImage = (index + propertyPage.images.length) % propertyPage.images.length;
  const selected = propertyPage.images[propertyPage.currentImage];
  const image = document.createElement("img");
  image.src = selected.file_path;
  image.alt = selected.alt;
  element("propertyMainMedia").replaceChildren(image);
  element("mediaCount").textContent = `${propertyPage.currentImage + 1} / ${propertyPage.images.length}`;
  document.querySelectorAll(".property-thumbnail").forEach((thumbnail, thumbnailIndex) => {
    thumbnail.classList.toggle("active", thumbnailIndex === propertyPage.currentImage);
    thumbnail.setAttribute("aria-current", thumbnailIndex === propertyPage.currentImage ? "true" : "false");
  });
}

function renderImages(media, propertyTitle) {
  propertyPage.images = media
    .filter((item) => item.media_type === "image")
    .map((item, index) => ({ file_path: safeMediaUrl(item.file_path), alt: `${propertyTitle} - photo ${index + 1}` }))
    .filter((item) => item.file_path);

  if (!propertyPage.images.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "property-media-placeholder";
    const icon = document.createElement("span");
    icon.textContent = "⌂";
    const message = document.createElement("p");
    message.textContent = "Property images will be added soon.";
    placeholder.append(icon, message);
    element("propertyMainMedia").replaceChildren(placeholder);
    return;
  }

  const thumbnails = propertyPage.images.map((item, index) => {
    const button = document.createElement("button");
    button.className = "property-thumbnail";
    button.type = "button";
    button.setAttribute("aria-label", `Show photo ${index + 1}`);
    const image = document.createElement("img");
    image.src = item.file_path;
    image.alt = "";
    image.loading = "lazy";
    button.append(image);
    button.addEventListener("click", () => showImage(index));
    return button;
  });
  element("propertyThumbnails").replaceChildren(...thumbnails);

  const hasMultipleImages = propertyPage.images.length > 1;
  element("previousMedia").hidden = !hasMultipleImages;
  element("nextMedia").hidden = !hasMultipleImages;
  element("mediaCount").hidden = false;
  showImage(0);
}

function isDirectVideo(url) {
  try {
    return /\.(?:mp4|webm)$/i.test(new URL(url, window.location.href).pathname);
  } catch {
    return false;
  }
}

function renderVideos(media) {
  const videos = media
    .filter((item) => item.media_type === "video")
    .map((item) => safeMediaUrl(item.file_path))
    .filter(Boolean);
  if (!videos.length) return;

  const cards = videos.map((url, index) => {
    if (isDirectVideo(url) || url.startsWith("uploads/")) {
      const video = document.createElement("video");
      video.src = url;
      video.controls = true;
      video.preload = "metadata";
      video.setAttribute("aria-label", `Property video ${index + 1}`);
      return video;
    }
    const link = document.createElement("a");
    link.className = "property-video-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = `Open property video ${index + 1} →`;
    return link;
  });
  element("propertyVideos").replaceChildren(...cards);
  element("videoSection").hidden = false;
}

function renderLinks(media) {
  const links = media
    .filter((item) => item.media_type === "link")
    .map((item) => safeMediaUrl(item.file_path))
    .filter(Boolean);
  if (!links.length) return;

  const linkElements = links.map((url, index) => {
    const link = document.createElement("a");
    link.className = "property-external-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    const label = document.createElement("span");
    label.textContent = `Property link ${index + 1}`;
    const arrow = document.createElement("span");
    arrow.textContent = "↗";
    link.append(label, arrow);
    return link;
  });
  element("propertyLinks").replaceChildren(...linkElements);
  element("linksSection").hidden = false;
}

function renderProperty(property) {
  const title = String(property.title || "Property details");
  const listingType = labelValue(property.listing_type || "listing");
  const status = labelValue(property.status || "available");
  const address = propertyAddress(property);
  const pkrPrice = formatPkr(property.price_pkr, property.listing_type);
  const usdPrice = formatUsd(property.price, property.listing_type);
  const primaryPrice = pkrPrice || usdPrice || "Price on request";
  const secondaryPrice = pkrPrice && usdPrice ? usdPrice : "";

  document.title = `Heera Estate | ${title}`;
  element("propertyTitle").textContent = title;
  element("propertyListingType").textContent = property.listing_type === "rent" ? "For rent" : "For sale";
  element("propertyType").textContent = labelValue(property.property_type || "Property");
  element("propertyStatus").textContent = status;
  element("propertyLocation").textContent = address || "Location available on request";
  element("propertyPrice").textContent = primaryPrice;
  if (secondaryPrice) {
    element("propertySecondaryPrice").textContent = secondaryPrice;
    element("propertySecondaryPrice").hidden = false;
  }
  element("propertyReference").textContent = `#${property.property_id}`;

  const facts = element("propertyFacts");
  addFact(facts, "Listing", listingType);
  addFact(facts, "Property type", labelValue(property.property_type));
  addFact(facts, "Status", status);
  addFact(facts, "Size", property.size_label);
  addFact(facts, "Facing", property.property_facing);
  addFact(facts, "Bedrooms", property.bedrooms !== null ? formatNumber(property.bedrooms, 1) : "");
  addFact(facts, "Bathrooms", property.bathrooms !== null ? formatNumber(property.bathrooms, 1) : "");
  addFact(facts, "Area", property.area_sqft ? `${formatNumber(property.area_sqft)} sq ft` : "");
  addFact(facts, "Per Marla", property.price_per_marla ? `PKR ${formatNumber(property.price_per_marla)}` : "");
  addFact(facts, "Address", address);

  const description = String(property.description || "").trim();
  if (description) {
    element("propertyDescription").textContent = description;
  } else {
    element("descriptionSection").hidden = true;
  }

  const media = Array.isArray(property.media) ? property.media : [];
  renderImages(media, title);
  renderVideos(media);
  renderLinks(media);

  const enquiryText = encodeURIComponent(`Hello, I am interested in property #${property.property_id}: ${title}. Please share more information.`);
  element("whatsAppEnquiry").href = `https://wa.me/923000660446?text=${enquiryText}`;
  element("propertyLoading").hidden = true;
  element("propertyContent").hidden = false;
}

function showPropertyError(title, message) {
  element("propertyLoading").hidden = true;
  element("propertyContent").hidden = true;
  element("propertyErrorTitle").textContent = title;
  element("propertyErrorMessage").textContent = message;
  element("propertyError").hidden = false;
}

async function loadProperty() {
  if (!Number.isInteger(propertyPage.id) || propertyPage.id < 1) {
    showPropertyError("No property was selected.", "Return to the listings and click the property you want to view.");
    return;
  }

  try {
    const response = await fetch(`api.php?action=property&property_id=${encodeURIComponent(propertyPage.id)}`, {
      headers: { Accept: "application/json" }
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || "This property could not be loaded.");
    if (!result || !result.property_id) throw new Error("The server returned incomplete property information.");
    renderProperty(result);
  } catch (error) {
    showPropertyError("We couldn’t load this property.", error.message || "Please try again later.");
  }
}

element("previousMedia").addEventListener("click", () => showImage(propertyPage.currentImage - 1));
element("nextMedia").addEventListener("click", () => showImage(propertyPage.currentImage + 1));
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") showImage(propertyPage.currentImage - 1);
  if (event.key === "ArrowRight") showImage(propertyPage.currentImage + 1);
});
element("year").textContent = new Date().getFullYear();
loadProperty();