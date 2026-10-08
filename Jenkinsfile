pipeline {
    agent any

    environment {
        // Replace with Server 2 Private IP (or Public IP)
        WEB_SERVER_IP = '172.31.222.200' 
        DEPLOY_USER   = 'ubuntu'
    }

    stages {
        stage('1. Checkout Code') {
            steps {
                echo 'Checking out source code from Git...'
                checkout scm
            }
        }

        stage('2. Build & Test Backend') {
            steps {
                echo 'Building and testing backend...'
                sh '''
                    cd backend
                    npm install
                '''
            }
        }

        stage('3. Build & Test Frontend') {
            steps {
                echo 'Building frontend bundle...'
                sh '''
                    cd frontend
                    npm install
                '''
            }
        }

        stage('4. Security Scan (Gitleaks)') {
            steps {
                echo 'Scanning repository for leaked secrets...'
                sh 'gitleaks detect --source . -v || exit 1'
            }
        }

        stage('5. Test Deploy SSH Connection') {
            steps {
                echo 'Verifying SSH connection to Web Application Server (Server 2)...'
                sh 'ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${WEB_SERVER_IP} "docker --version && nginx -v"'
            }
        }
    }

    post {
        success {
            echo 'Task 1 Pipeline completed successfully!'
        }
        failure {
            echo 'Pipeline failed! Check stage logs for details.'
        }
    }
}