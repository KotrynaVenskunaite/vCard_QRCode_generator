document.addEventListener("DOMContentLoaded", () => {


    const fName = document.getElementById("first_name");
    const lName = document.getElementById("last_name");
    const phone = document.getElementById("phone_number");
    const email = document.getElementById("email");
    const street = document.getElementById("adress_street");
    const city = document.getElementById("adress_city");
    const country = document.getElementById("adress_country");
    const bday = document.getElementById("birthday");
    const qrcodeButton = document.getElementById("qrcode_button");
    const qrcodeImg = document.getElementById("qrcode_image");
    const downloadButton = document.getElementById("download_button");
    const name_alert = document.getElementById("name_alert");
    const tel_alert = document.getElementById("tel_alert");
    const form = document.getElementById("field_form");
    const entry_container = document.getElementById('entry_container');


    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        name_alert.textContent = ""
        tel_alert.textContent = ""
        if(fName.value == null || fName.value == ""){
        name_alert.textContent = "Contact name must exist"
            return;
        }
        if(phone.value == null || phone.value == ""){
        tel_alert.textContent = "Contact number must exist"
            return;
        }

        const response = await fetch('http://localhost:3000/api/qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fname: fName.value, lname: lName.value, tel: phone.value, email: email.value, street: street.value, city: city.value , country: country.value, date: bday.value})
        })
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Failed to save contact");
        }
        const id = data.id;

        // Step 2: Use that ID to request the QR code
        const qrResponse = await fetch(`http://localhost:3000/api/qr/${id}`);
        const qrData = await qrResponse.json();

        if (!qrResponse.ok) {
        throw new Error(qrData.error || "Failed to generate QR code");
        }
        qrcodeImg.src = qrData.qrCode;
        console.log(qrData.qrCode);
        downloadButton.disabled = false;
        
    });

    downloadButton.addEventListener("click", () => {
        const downloadLink = document.createElement("a");
        downloadLink.href = qrcodeImg.src;
        downloadLink.download = "contact-qr-code.png";
        downloadLink.click();
    });

    // Function to load all previous entries
    function loadEntries() {
      fetch('http://localhost:3000/api/qr')
        .then(response => response.json())
        .then(data => {
          entry_container.innerHTML = '';
          data.reverse().forEach(contact  => { // Reverse the array
            const entry = document.createElement('div');
            entry.id = 'entries';
            entry.classList.add('entries');

            // Create the retrieve button
            const retrieveButton = document.createElement('div');
            retrieveButton.classList.add('retrieve_button');
            retrieveButton.id = contact.id;
            retrieveButton.textContent = '+';
            retrieveButton.addEventListener('click', function () {
                retrieveContact(contact.id);
            });

            // Create the contact name
            const name = document.createElement('div');
            name.id = 'entry_name';
            name.textContent =
            `${contact.fname || ''} ${contact.lname || ''}`.trim();

            // Create the telephone number
            const tel = document.createElement('div');
            tel.id = 'entry_tel';
            tel.textContent = contact.tel || 'No telephone number';

            // Append the elements to the entry
            entry.appendChild(retrieveButton);
            entry.appendChild(name);
            entry.appendChild(tel);

            // Append the entry to the main container
        entry_container.appendChild(entry);
          });
        })
        .catch(err => console.error("Error fetching comments:", err));
    }
    loadEntries();

    async function retrieveContact(id) {
    try {
        const response = await fetch(
        `http://localhost:3000/api/qr/${id}`
        );

        const data = await response.json();

        if (!response.ok) {
        throw new Error(data.error || 'Failed to retrieve contact');
        }

        // Fill in the contact inputs
        fName.value = data.fname || '';
        lName.value = data.lname || '';
        phone.value = data.tel || '';
        email.value = data.email || '';
        street.value = data.street || '';
        city.value = data.city || '';
        country.value = data.country || '';

        // Birthday input (make sure this variable exists)
        const birthday = document.getElementById('birthday');
        if (birthday) {
        birthday.value = data.date
            ? String(data.date).slice(0, 10)
            : '';
        }

        // Display the saved QR code image
        qrcodeImg.src = data.qrCode;
        downloadButton.disabled = false;

    } catch (error) {
        console.error('Error retrieving contact:', error);
    }
    }

    function retrieveLogs(){
        fetch('http://localhost:3000/api/logs')
        .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch logs');
        }
        return response.json();
        })
        .then(data => {
        const logContainer = document.getElementById('log_container');

        // Clear existing logs
        logContainer.innerHTML = '';

        // Show newest logs first
        data.reverse().forEach(log => {
            // Create the main log entry
            const entry = document.createElement('div');
            entry.classList.add('log_entries');

            // Create each field
            const time = document.createElement('div');
            time.classList.add('time');
            time.textContent = '|| LOG TIME: ' + log.timestamp + ' ||' || '';

            const ip = document.createElement('div');
            ip.classList.add('ip');
            ip.textContent = 'IP: ' + log.ip + ' ||' || '';

            const method = document.createElement('div');
            method.classList.add('method');
            method.textContent = ' METHOD: ' + log.method + ' ||'|| '';

            const path = document.createElement('div');
            path.classList.add('path');
            path.textContent = ' PATH: ' + log.path + ' ||'|| '';

            const status = document.createElement('div');
            status.classList.add('status');
            status.textContent = ' STATUS: ' + log.status + ' ||' ?? '';

            const user = document.createElement('div');
            user.classList.add('user');
            user.textContent = ' AGENT: ' + log.userAgent + ' ||' || '';

            const duration = document.createElement('div');
            duration.classList.add('duration');
            duration.textContent = ' DURATION: ' +
            log.durationMs != null ? `${log.durationMs} ms` + ' ||' : '';

            // Add fields to the log entry
            entry.append(
            time,
            ip,
            method,
            path,
            status,
            user,
            duration
            );

            // Add the entry to the container
            logContainer.appendChild(entry);
        });
        })
        .catch(error => {
            console.error('Error fetching logs:', error);
        });
    }
    retrieveLogs();

});


//   function generate_vCard(firstName, lastName, phone, email, street, city, country, bday){
//         const vcard = [
//             "BEGIN:VCARD",
//             "VERSION:3.0",
//             `N:${lastName};${firstName};;;`,
//             `FN:${firstName} ${lastName}`,
//             `TEL;TYPE=CELL:${phone}`,
//             `EMAIL:${email}`,
//             `ADR;TYPE=HOME:;;${street};${city};;;${country}`,
//             `BDAY:${bday}`,
//             "END:VCARD"
//         ].join("\r\n");

//         return vcard;
//     }