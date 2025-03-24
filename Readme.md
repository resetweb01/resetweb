### Backend service that syncs with Gmail, filters emails based on a subject, and extracts a verification link from the email content.

Start the ssh server
`ssh gto0ell69yqd@68.178.231.65`

Navigate to project directory

### Upload your project files or update
`scp -r "C:\Users\Administrator\Desktop\Reset Web\backend\*" gto0ell69yqd@sg2plzcpnl508745.prod.sin2.secureserver.net:~/public_html/Backend`


`pm2 restart resetweb`  after making any changes

### Setting Up Node.js, PM2, and Auto-Start on Reboot
1. Install Node.js and npm
`
### Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

#### Reload shell
source ~/.bashrc

#### Install the latest LTS version of Node.js
nvm install --lts

#### Verify installation
node --version
npm --version
`

2. Install PM2
`
#### Install PM2 globally
npm install -g pm2

#### Verify installation
pm2 --version
`

3. Start Your Application with PM2
`
#### Navigate to your project directory
cd ~/public_html/Backend

#### Start your application with PM2
pm2 start index.js --name "resetweb"

#### Check the status of your application
pm2 status
`

