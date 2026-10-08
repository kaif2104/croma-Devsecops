pipeline {
    agent any

    environment {
        WEB_SERVER_IP = '172.31.222.200' 
        DEPLOY_USER   = 'ubuntu'
    }

    stages {
        stage('1. Checkout Code') {
            steps {
                checkout scm
            }
        }

        stage('2. Build Backend & Frontend') {
            steps {
                echo 'Building backend and frontend dependencies...'
                sh '''
                    docker run --rm -v $(pwd)/backend:/app -w /app node:18-alpine npm install
                    docker run --rm -v $(pwd)/frontend:/app -w /app node:18-alpine npm install
                '''
            }
        }

        stage('3. Security Gate - Gitleaks Secret Scan') {
            steps {
                echo 'Scanning for secrets with Gitleaks...'
                sh 'gitleaks detect --source . --verbose || exit 1'
            }
        }

        stage('4. Security Gate - SonarQube Analysis') {
            steps {
                echo 'Running SonarQube Code Quality & SAST scan for project croma...'
                withSonarQubeEnv('SonarQube') {
                    sh '''
                        sonar-scanner \
                          -Dsonar.projectKey=croma \
                          -Dsonar.projectName=croma \
                          -Dsonar.sources=backend,frontend/src \
                          -Dsonar.host.url=http://172.17.0.1:9000 \
                          -Dsonar.login=$SONAR_AUTH_TOKEN
                    '''
                }
            }
        }

        stage('5. Quality Gate Gatekeeper') {
            steps {
                timeout(time: 2, unit: 'MINUTES') {
                    script {
                        echo 'Checking SonarQube Quality Gate Status...'
                        def qg = waitForQualityGate()
                        if (qg.status != 'OK') {
                            error "Pipeline aborted due to Quality Gate failure: ${qg.status}"
                        } else {
                            echo "Quality Gate PASSED for croma!"
                        }
                    }
                }
            }
        }

        stage('6. Deploy to Web Server') {
            steps {
                echo 'Quality Gate Passed! Deploying croma to Server 2...'
                sh 'ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${WEB_SERVER_IP} "echo Deployment Started for croma"'
            }
        }
    }

    post {
        success {
            echo 'Task 2 — Security Gate PASSED for croma!'
        }
        failure {
            echo 'Task 2 — Security Gate FAILED for croma. Deployment stopped!'
        }
    }
}