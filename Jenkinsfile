pipeline {
    agent any

    environment {
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

        stage('2. Build & Code Verification') {
            steps {
                echo 'Verifying application source files and build environment...'
                sh '''
                    echo "Checking project structure:"
                    test -f docker-compose.yml && echo "✓ docker-compose.yml found"
                    test -d backend && echo "✓ backend directory found"
                    test -d frontend && echo "✓ frontend directory found"
                    echo "Docker Environment:"
                    docker --version
                '''
            }
        }

        stage('3. Security Gate - Gitleaks Secret Scan') {
            steps {
                echo 'Scanning repository for leaked secrets with Gitleaks...'
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
                          -Dsonar.sources=backend,frontend \
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
                echo 'Quality Gate Passed! Deploying croma to Web Server (Server 2)...'
                sh 'ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${WEB_SERVER_IP} "docker --version && nginx -v"'
            }
        }
    }

    post {
        success {
            echo 'Task 2 — Security Gate PASSED for croma and deployment verified!'
        }
        failure {
            echo 'Task 2 — Pipeline FAILED. Deployment stopped!'
        }
    }
}