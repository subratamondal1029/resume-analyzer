const form = document.getElementById("upload-form");
const fileInput = document.getElementById("fileInput");
const submitBtn = document.getElementById("submitBtn");
const statusText = document.getElementById("statusText");
const progressBar = document.getElementById("progressBar");
const resultDiv = document.getElementById("result");

let currentSource = null;

function setProgress(pct, status) {
  progressBar.style.width = pct + "%";
  progressBar.setAttribute("aria-valuenow", pct);
  statusText.textContent = status + ` (${pct}%)`;
}

function showResult(result) {
  // Clear previous results
  resultDiv.innerHTML = "";

  // Create card for single result object
  const card = document.createElement("div");
  card.className = "result-card";

  const statusBadge = document.createElement("div");
  statusBadge.className = `result-status ${result.status}`;
  statusBadge.textContent = result.status?.toUpperCase() || "UNKNOWN";
  card.appendChild(statusBadge);

  const evidenceField = document.createElement("div");
  evidenceField.className = "result-field";
  evidenceField.innerHTML = `<label>Evidence</label><p>${
    result.evidence || "N/A"
  }</p>`;
  card.appendChild(evidenceField);

  const reasoningField = document.createElement("div");
  reasoningField.className = "result-field";
  reasoningField.innerHTML = `<label>Reasoning</label><p>${
    result.reasoning || "N/A"
  }</p>`;
  card.appendChild(reasoningField);

  const confidenceField = document.createElement("div");
  confidenceField.className = "result-field";
  const confidenceBar = document.createElement("div");
  confidenceBar.className = "confidence-bar";
  confidenceBar.innerHTML = `<label>Confidence Score:</label><span class="confidence-value">${
    result.confidence != null ? result.confidence + "%" : "N/A"
  }</span>`;
  confidenceField.appendChild(confidenceBar);
  card.appendChild(confidenceField);

  resultDiv.appendChild(card);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!fileInput.files.length) {
    alert("Please choose a resume PDF file first.");
    return;
  }

  // Get review criteria values
  const role = document.getElementById("role").value.trim();
  const skillsInput = document.getElementById("skills").value.trim();
  const experience = document.getElementById("experience").value.trim();
  const otherDetails = document.getElementById("otherDetails").value.trim();

  // Validate required fields
  if (!role || !skillsInput || !experience) {
    alert("Please fill in all required fields (Role, Skills, Experience).");
    return;
  }

  // Convert skills string to array
  const skills = skillsInput
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s);

  submitBtn.disabled = true;
  statusText.textContent = "Uploading resume...";

  const data = new FormData();
  data.append("file", fileInput.files[0]);
  data.append(
    "rules",
    JSON.stringify({
      role,
      skills,
      experience,
      other_details: otherDetails || undefined,
    })
  );

  try {
    const resp = await fetch("/api/pdf-analyze", {
      method: "POST",
      body: data,
    });

    const json = await resp.json();

    if (!resp.ok) {
      console.log(json);

      throw new Error(json?.message || "Upload failed");
    }

    const { analysisId, fileName } = json?.data || {};
    resultDiv.textContent = `Reviewing resume: ${fileName}`;
    setProgress(0, "Starting resume review...");

    if (!analysisId) {
      throw new Error("No analysisId returned from server");
    }

    // Close any previous SSE
    if (currentSource) {
      currentSource.close();
    }

    currentSource = new EventSource(`/api/pdf-analyze/status/${analysisId}`);

    currentSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { progress, status } = data;

        setProgress(progress, status);
        if (progress >= 100) {
          const { data: resultData } = data;

          if (!resultData.error) {
            showResult(resultData);
          } else {
            console.error("Analysis error:", resultData.error);
          }

          currentSource.close();
          submitBtn.disabled = false;
        }
      } catch (err) {
        console.error("Parse error:", err);
      }
    };

    currentSource.onerror = (err) => {
      console.error("SSE error", err);
      statusText.textContent = "Connection error.";
      currentSource.close();
      submitBtn.disabled = false;
    };
  } catch (err) {
    console.error(err);
    alert(err.message);
    statusText.textContent = "Failed.";
    submitBtn.disabled = false;
  }
});
