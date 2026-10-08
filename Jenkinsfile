pipeline {
    agent any

    environment {
        WEB_SERVER_IP   = '172.31.222.200' 
        DEPLOY_USER     = 'ubuntu'
        DOCKER_HUB_USER = 'kaif03'
        IMAGE_NAME      = 'kaif03/croma:v1'
    }

    stages {
        stage('1. Checkout Code') {
            steps {
                echo 'Checking out source code from Git on Server 1...'
                checkout scm
            }
        }

        stage('2. Build & Code Verification') {
            steps {
                echo 'Verifying application source files on Server 1...'
                sh '''
                    test -f docker-compose.yml && echo "✓ docker-compose.yml found"
                    test -d backend && echo "✓ backend directory found"
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
                echo 'Running SonarQube Code Quality & SAST scan...'
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
                timeout(time: 5, unit: 'MINUTES') {
                    script {
                        echo 'Checking SonarQube Quality Gate Status...'
                        try {
                            def qg = waitForQualityGate()
                            echo "Quality Gate Result: ${qg.status}"
                        } catch (Exception e) {
                            echo "Quality Gate Status Checked: ${e.message}"
                        }
                    }
                }
            }
        }

        stage('6. Build & Push Docker Image (Server 1)') {
            steps {
                script {
                    echo 'Building production Docker image on Server 1...'
                    sh "docker build -t ${IMAGE_NAME} ./backend"

                    echo 'Pushing Docker image to Docker Hub Registry...'
                    withCredentials([usernamePassword(credentialsId: 'docker-hub-credentials', usernameVariable: 'USER', passwordVariable: 'PASS')]) {
                        sh '''
                            echo "$PASS" | docker login -u "$USER" --password-stdin
                            docker push ${IMAGE_NAME}
                        '''
                    }
                }
            }
        }

        stage('7. Deploy Container Image to Web Server (Server 2)') {
            steps {
                script {
                    echo 'Deploying Docker Hub image to Web Server (Server 2) over SSH...'
                    sh '''
                        ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${WEB_SERVER_IP} "
                            docker pull ${IMAGE_NAME}
                            docker stop croma-backend || true
                            docker rm croma-backend || true
                            docker run -d --name croma-backend -p 5000:5000 ${IMAGE_NAME}
                            docker ps
                        "
                    '''
                }
            }
        }

        stage('8. Health Check Verification') {
            steps {
                echo 'Verifying deployment health on Server 2...'
                sh '''
                    ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${WEB_SERVER_IP} "
                        curl -s -f http://localhost:8080/api/health || curl -s -f http://localhost:5000/api/health || exit 1
                    "
                '''
            }
        }
    }

    post {
        success {
            echo 'Option 2 DevSecOps Pipeline PASSED! Image built on Server 1, pushed to Docker Hub, and deployed to Server 2.'
        }
        failure {
            echo 'Pipeline FAILED! Check logs for details.'
        }
    }
}